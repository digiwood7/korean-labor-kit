/**
 * 한국 공휴일 조회 — KASI(한국천문연구원) 특일정보 API 클라이언트
 *
 * 원본의 lib/utils/holidays.ts를 이식했다. 원본은 Next.js 서버/브라우저 겸용(내부에서
 * `/api/holidays`를 호출)이었으나, 이 라이브러리는 프레임워크에 종속되지 않도록:
 *   - 브라우저 전용 분기(`typeof window`, `/api/holidays`)를 제거하고
 *   - API 키를 생성자 옵션(`apiKey`)으로 주입(미지정 시 env `HOLIDAY_API_KEY` 폴백)받고
 *   - `fetch`를 주입 가능하게 해(테스트에서 mock) 실제 네트워크 없이 검증할 수 있게 했다.
 *
 * 연도별 조회 결과는 인스턴스 메모리에 캐시된다(같은 연도 재조회 시 네트워크 호출 없음).
 * 대체공휴일은 KASI가 `isHoliday: "Y"` 항목으로 내려주며, 폴백 표에도 포함돼 있다.
 */

import { DEFAULT_HOLIDAYS_WITH_NAMES } from "./fallbackHolidays.js";

/** 주입 가능한 fetch의 최소 응답 형태 (전역 fetch의 Response가 이 형태를 만족한다). */
export interface HolidayFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** 주입 가능한 fetch 함수 형태. */
export type HolidayFetch = (url: string) => Promise<HolidayFetchResponse>;

export interface HolidayClientOptions {
  /** KASI 특일정보 서비스 키. 미지정 시 env `HOLIDAY_API_KEY` 폴백. 둘 다 없으면 내장 폴백 표 사용. */
  apiKey?: string;
  /** fetch 구현 주입(테스트용). 미지정 시 전역 fetch. */
  fetch?: HolidayFetch;
  /** API 불가 시 사용할 폴백 공휴일 표(연도 → { "YYYY-MM-DD": 이름 }). 미지정 시 내장 2025~2027 표. */
  fallback?: Record<number, Record<string, string>>;
}

/** KASI getRestDeInfo 응답의 개별 항목 */
interface KasiHolidayItem {
  locdate: number; // YYYYMMDD
  dateName: string;
  isHoliday: string; // "Y" | "N"
}

/** KASI 응답의 items는 배열/단일객체/빈문자열("") 중 하나로 온다. */
type KasiItems = { item?: KasiHolidayItem | KasiHolidayItem[] } | string;

interface KasiResponse {
  response?: { body?: { items?: KasiItems } };
}

/**
 * Date를 로컬(설정 시간대) 기준 "YYYY-MM-DD"로 변환한다.
 * toISOString()은 UTC 기준이라 KST 환경에서 하루 어긋날 수 있어 로컬 게터를 쓴다.
 * (KST 서버/개발환경 기준으로 원본과 동일 동작)
 */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 특정 날짜가 주말(토/일)인지 확인한다 (공휴일 조회 없이 즉시 판정).
 *
 * 문자열은 `new Date(date)`로 그대로 파싱하면 UTC 자정으로 해석되어, 음수 오프셋
 * 타임존(예: America/New_York)에서 로컬 날짜가 하루 전날로 밀려 요일 판정이 틀어진다.
 * `getDayType`(src/overtime/laborPay.ts)과 동일하게 로컬 자정으로 앵커링해 이를 막는다.
 *
 * @param date Date 또는 "YYYY-MM-DD" 문자열
 */
export function isWeekend(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? new Date(date.slice(0, 10) + "T00:00:00") : date;
  const day = dateObj.getDay();
  return day === 0 || day === 6; // 일요일(0) 또는 토요일(6)
}

/**
 * 한국 공휴일 조회 클라이언트.
 * 연도별 결과를 인스턴스 메모리에 캐시하며, KASI API 키가 없으면 내장 폴백 표를 쓴다.
 *
 * ```ts
 * const client = new HolidayClient({ apiKey: process.env.HOLIDAY_API_KEY });
 * await client.isHoliday("2026-03-01"); // true (삼일절)
 * ```
 */
export class HolidayClient {
  private readonly apiKey: string;
  private readonly fetchImpl: HolidayFetch;
  private readonly fallback: Record<number, Record<string, string>>;
  private readonly dateCache = new Map<number, Set<string>>();
  private readonly nameCache = new Map<number, Map<string, string>>();

  constructor(options: HolidayClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.HOLIDAY_API_KEY ?? "";
    this.fetchImpl = options.fetch ?? ((url) => fetch(url));
    this.fallback = options.fallback ?? DEFAULT_HOLIDAYS_WITH_NAMES;
  }

  /** 해당 연도의 공휴일 날짜 집합("YYYY-MM-DD")을 반환한다(캐시 적용). */
  async getHolidays(year: number): Promise<Set<string>> {
    const cached = this.dateCache.get(year);
    if (cached) return cached;

    if (!this.apiKey) return this.cacheFallback(year);

    try {
      const { dates, names } = await this.fetchFromApi(year);
      const set = new Set(dates);
      this.dateCache.set(year, set);
      this.nameCache.set(year, names);
      return set;
    } catch {
      // 네트워크/HTTP 오류 시 폴백 표로 대체
      return this.cacheFallback(year);
    }
  }

  /** 해당 연도의 공휴일 이름 맵(날짜 → 이름)을 반환한다(대체공휴일 포함). */
  async getHolidayNames(year: number): Promise<Map<string, string>> {
    if (!this.nameCache.has(year)) await this.getHolidays(year);
    const cached = this.nameCache.get(year);
    if (cached) return cached;
    return new Map(Object.entries(this.fallback[year] ?? {}));
  }

  /** 특정 날짜가 공휴일인지 확인한다. */
  async isHoliday(date: Date | string): Promise<boolean> {
    const dateStr = typeof date === "string" ? date.slice(0, 10) : formatLocalDate(date);
    const year = Number(dateStr.slice(0, 4));
    const holidays = await this.getHolidays(year);
    return holidays.has(dateStr);
  }

  /** 특정 날짜가 주말 또는 공휴일인지 확인한다. */
  async isWeekendOrHoliday(date: Date | string): Promise<boolean> {
    if (isWeekend(date)) return true;
    return this.isHoliday(date);
  }

  /**
   * 해당 연도 공휴일을 { dates, names } 로 반환한다.
   * names는 JSON 직렬화가 쉽도록 Map이 아닌 일반 객체로 준다(예: API 응답 바디).
   */
  async getHolidayData(year: number): Promise<{ dates: string[]; names: Record<string, string> }> {
    await this.getHolidays(year); // 캐시 채움
    const dates = Array.from(this.dateCache.get(year) ?? []);
    const namesMap = this.nameCache.get(year) ?? new Map(Object.entries(this.fallback[year] ?? {}));
    return { dates, names: Object.fromEntries(namesMap) };
  }

  /** 폴백 표를 캐시에 채우고 날짜 집합을 반환한다. */
  private cacheFallback(year: number): Set<string> {
    const table = this.fallback[year] ?? {};
    const set = new Set(Object.keys(table));
    this.dateCache.set(year, set);
    if (!this.nameCache.has(year)) {
      this.nameCache.set(year, new Map(Object.entries(table)));
    }
    return set;
  }

  /**
   * KASI 특일정보 API에서 해당 연도 공휴일을 조회한다(월별 12회 호출 — API 제약).
   * 어느 한 달이라도 HTTP 오류면 예외를 던지고, 호출측(getHolidays)이 폴백으로 대체한다.
   */
  private async fetchFromApi(year: number): Promise<{ dates: string[]; names: Map<string, string> }> {
    const dates: string[] = [];
    const names = new Map<string, string>();

    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, "0");
      const url =
        `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
        `?solYear=${year}&solMonth=${monthStr}&ServiceKey=${this.apiKey}&_type=json`;

      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`공휴일 API 요청 실패: ${res.status}`);

      const data = (await res.json()) as KasiResponse;
      const items = data.response?.body?.items;
      const rawItem = items && typeof items === "object" ? items.item : undefined;
      if (!rawItem) continue;

      const list = Array.isArray(rawItem) ? rawItem : [rawItem];
      for (const item of list) {
        if (item.isHoliday !== "Y") continue;
        const s = String(item.locdate); // YYYYMMDD
        const formatted = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        dates.push(formatted);
        names.set(formatted, item.dateName);
      }
    }

    return { dates, names };
  }
}
