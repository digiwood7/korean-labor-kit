import { describe, expect, it } from "vitest";
import { HolidayClient, isWeekend, type HolidayFetch } from "./holidays.js";

/**
 * 공휴일 클라이언트 테스트.
 * 실제 KASI API는 절대 호출하지 않는다 — fetch를 mock으로 주입해 응답 파싱/캐시/폴백만 검증한다.
 */

type KasiItem = { locdate: number; dateName: string; isHoliday: string };

// 가상의 KASI 월별 응답 픽스처(2026년). 실제 서비스/직원 데이터가 아니다.
const FIXTURE_2026: Record<string, KasiItem[] | KasiItem> = {
  // 단일 객체로 오는 달(항목이 1개일 때 KASI는 배열이 아닌 객체를 준다)
  "01": { locdate: 20260101, dateName: "1월1일", isHoliday: "Y" },
  // 배열 + isHoliday "N" 항목 섞임(공휴일 아닌 특일은 제외돼야 한다)
  "02": [
    { locdate: 20260216, dateName: "설날", isHoliday: "Y" },
    { locdate: 20260217, dateName: "설날", isHoliday: "Y" },
    { locdate: 20260218, dateName: "설날", isHoliday: "Y" },
    { locdate: 20260214, dateName: "밸런타인데이", isHoliday: "N" },
  ],
  // 대체공휴일 포함
  "03": [
    { locdate: 20260301, dateName: "삼일절", isHoliday: "Y" },
    { locdate: 20260302, dateName: "대체공휴일(삼일절)", isHoliday: "Y" },
  ],
};

/** solMonth 픽스처를 KASI 응답 형태로 감싸 돌려주는 mock fetch. 호출 횟수를 센다. */
function makeFakeFetch(counter: { count: number }): HolidayFetch {
  return async (url: string) => {
    counter.count += 1;
    const month = new URL(url).searchParams.get("solMonth") ?? "";
    const item = FIXTURE_2026[month];
    const items = item === undefined ? "" : { item };
    return {
      ok: true,
      status: 200,
      json: async () => ({ response: { body: { items } } }),
    };
  };
}

describe("HolidayClient — KASI API (mock fetch)", () => {
  it("월별 응답을 파싱해 공휴일 집합을 만든다(대체공휴일 포함, isHoliday=N 제외)", async () => {
    const counter = { count: 0 };
    const client = new HolidayClient({ apiKey: "TEST", fetch: makeFakeFetch(counter) });
    const holidays = await client.getHolidays(2026);

    expect(holidays.has("2026-01-01")).toBe(true); // 단일 객체 응답
    expect(holidays.has("2026-02-16")).toBe(true);
    expect(holidays.has("2026-03-01")).toBe(true);
    expect(holidays.has("2026-03-02")).toBe(true); // 대체공휴일
    expect(holidays.has("2026-02-14")).toBe(false); // isHoliday "N" → 제외
    expect(holidays.size).toBe(6);
    expect(counter.count).toBe(12); // 월별 12회 호출
  });

  it("같은 연도는 캐시에서 반환한다(추가 네트워크 호출 없음)", async () => {
    const counter = { count: 0 };
    const client = new HolidayClient({ apiKey: "TEST", fetch: makeFakeFetch(counter) });
    await client.getHolidays(2026);
    await client.getHolidays(2026);
    expect(counter.count).toBe(12); // 두 번째 호출은 캐시
  });

  it("이름 맵과 getHolidayData(직렬화용 객체)를 제공한다", async () => {
    const counter = { count: 0 };
    const client = new HolidayClient({ apiKey: "TEST", fetch: makeFakeFetch(counter) });
    const names = await client.getHolidayNames(2026);
    expect(names.get("2026-03-02")).toBe("대체공휴일(삼일절)");

    const data = await client.getHolidayData(2026);
    expect(data.dates).toContain("2026-03-01");
    expect(data.names["2026-01-01"]).toBe("1월1일");
  });

  it("isHoliday / isWeekendOrHoliday 판정", async () => {
    const client = new HolidayClient({ apiKey: "TEST", fetch: makeFakeFetch({ count: 0 }) });
    expect(await client.isHoliday("2026-03-01")).toBe(true);
    expect(await client.isHoliday("2026-03-10")).toBe(false);
    expect(await client.isWeekendOrHoliday("2026-03-07")).toBe(true); // 토요일
    expect(await client.isWeekendOrHoliday("2026-03-02")).toBe(true); // 대체공휴일(월)
  });

  it("HTTP 오류(ok:false)면 폴백 표로 대체한다(예외 던지지 않음)", async () => {
    const failFetch: HolidayFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const client = new HolidayClient({ apiKey: "TEST", fetch: failFetch });
    const holidays = await client.getHolidays(2026);
    // 내장 폴백 표의 값이 나와야 한다
    expect(holidays.has("2026-05-25")).toBe(true); // 대체공휴일(부처님오신날)
  });
});

describe("HolidayClient — API 키 없음(폴백 표)", () => {
  it("apiKey가 비면 fetch를 호출하지 않고 내장 표를 쓴다", async () => {
    const counter = { count: 0 };
    const client = new HolidayClient({ apiKey: "", fetch: makeFakeFetch(counter) });
    const holidays = await client.getHolidays(2026);
    expect(counter.count).toBe(0); // 네트워크 호출 없음
    expect(holidays.has("2026-01-01")).toBe(true);
    expect(await client.isHoliday("2026-08-17")).toBe(true); // 대체공휴일(광복절)
  });

  it("fallback 옵션으로 표를 교체할 수 있다", async () => {
    const client = new HolidayClient({
      apiKey: "",
      fallback: { 2099: { "2099-01-01": "가상공휴일" } },
    });
    const holidays = await client.getHolidays(2099);
    expect(holidays.has("2099-01-01")).toBe(true);
    expect(await client.isHoliday("2099-01-01")).toBe(true);
  });
});

describe("isWeekend (순수 함수)", () => {
  it("토/일은 주말, 평일은 아니다", () => {
    expect(isWeekend("2026-03-07")).toBe(true); // 토
    expect(isWeekend("2026-03-08")).toBe(true); // 일
    expect(isWeekend("2026-03-09")).toBe(false); // 월
  });

  /**
   * 타임존 불변 회귀 방지.
   *
   * vitest 안에서는 실행 중 TZ를 바꿀 수 없으므로, "YYYY-MM-DD" 문자열 입력이
   * 로컬 자정 Date(y, m-1, d) 입력과 항상 같은 결과를 내는지로 대신 확인한다.
   * 수정 전에는 문자열을 `new Date(date)`(UTC 자정)로 파싱해 음수 오프셋
   * 타임존(예: America/New_York)에서 하루가 밀렸는데, 그 버그는 실행 타임존에
   * 좌우되므로 KST 실행만으로는 못 잡는다 — 대신 두 입력 경로의 동등성을 고정한다.
   */
  it("문자열 입력과 로컬 Date(y, m-1, d) 입력이 항상 같은 결과를 낸다 (파싱 경로 동등성)", () => {
    const cases: Array<[string, number, number, number]> = [
      ["2026-03-07", 2026, 3, 7], // 토
      ["2026-03-08", 2026, 3, 8], // 일
      ["2026-03-09", 2026, 3, 9], // 월
      ["2026-01-01", 2026, 1, 1], // 월초(달 경계에서 UTC 앵커링 버그가 가장 잘 드러나는 케이스)
      ["2026-12-31", 2026, 12, 31], // 월말/연말
    ];
    for (const [str, y, m, d] of cases) {
      expect(isWeekend(str)).toBe(isWeekend(new Date(y, m - 1, d)));
    }
  });
});
