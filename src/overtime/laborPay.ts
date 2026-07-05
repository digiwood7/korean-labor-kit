/**
 * 근로기준법 제56조 기반 연장·야간·휴일 근로수당 계산
 *
 * 배율 매트릭스 (통상임금 대비):
 *                      평일(소정근로일) 토요일(무급휴무일) 일요일/휴일(유급주휴일·공휴일)
 *   8h이내 주간(06~22)   1.0             1.5               1.5
 *   8h초과 주간(06~22)   1.5             1.5               2.0
 *   8h이내 야간(22~06)   1.5             2.0               2.0
 *   8h초과 야간(22~06)   2.0             2.0               2.5
 *
 * - 연장 +0.5 / 야간 +0.5 / 휴일 8h이내 +0.5·8h초과 +1.0 가산의 합.
 * - 일반(평일) 연장근로는 소정 8시간을 이미 채운 "초과" 근로이므로 priorHours=8 로 계산.
 * - 토/일/공휴일 근로 및 주말출장은 그날 처음부터 근로하므로 priorHours=0.
 *
 * 회사마다 다른 취업규칙은 {@link WorkRuleOptions}로 조정한다. 옵션을 주지 않으면
 * 위 매트릭스(토요일=무급휴무일, 야간=22~06시)가 기본값으로 적용되며, 결과는 원본과 100% 동일하다.
 */

export type DayType = "weekday" | "saturday" | "holiday";

/**
 * 회사별 취업규칙 옵션.
 * 옵션을 주지 않으면 근로기준법 제56조 기본값(토요일=무급휴무일, 야간=22~06시)으로 계산한다.
 */
export interface WorkRuleOptions {
  /**
   * 토요일 취급 방식.
   * - `"unpaid_holiday"` (기본): 무급휴무일 — 토요일 열(주간 1.5 / 야간 2.0, 8h 구분 없음)을 쓴다.
   * - `"paid_holiday"`: 유급휴일 — 일요일/공휴일 열과 동일하게 처리(8h이내 1.5 / 8h초과 2.0).
   */
  saturdayType?: "unpaid_holiday" | "paid_holiday";
  /**
   * 야간 가산 시간대(시 단위, 24시간제). 기본값은 22시~06시.
   * 예) `{ start: 22, end: 6 }` → 22:00~다음날 06:00 을 야간으로 본다(자정을 넘는 구간).
   * start < end 로 주면(예: `{ start: 0, end: 6 }`) 자정을 넘지 않는 단순 구간으로 해석한다.
   */
  nightRange?: { start: number; end: number };
}

type ZoneMult = { within: number; over: number };
export const LABOR_MULTIPLIERS: Record<DayType, { day: ZoneMult; night: ZoneMult }> = {
  weekday: { day: { within: 1.0, over: 1.5 }, night: { within: 1.5, over: 2.0 } },
  saturday: { day: { within: 1.5, over: 1.5 }, night: { within: 2.0, over: 2.0 } },
  holiday: { day: { within: 1.5, over: 2.0 }, night: { within: 2.0, over: 2.5 } },
};

const DEFAULT_NIGHT_START = 22 * 60; // 22:00
const DEFAULT_NIGHT_END = 6 * 60; // 06:00
const EIGHT_HOURS = 8 * 60;

// "HH:MM" / "HH:MM:SS" / "24:00" → 분
function toMin(time: string): number {
  const [h, m] = time.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/**
 * 절대 분(자정 넘김 포함)이 야간 구간인지 판정한다.
 * nightStart > nightEnd 이면 자정을 넘는 구간(기본 22~06)으로, nightStart < nightEnd 이면
 * 자정을 넘지 않는 단순 구간으로 해석한다.
 */
function isNightMinute(absMinute: number, nightStart: number, nightEnd: number): boolean {
  const c = ((absMinute % 1440) + 1440) % 1440;
  if (nightStart > nightEnd) return c >= nightStart || c < nightEnd; // 자정 넘김
  return c >= nightStart && c < nightEnd; // 자정 안 넘김
}

/**
 * 날짜 → 요일 구분 (공휴일이면 holiday, 일요일=holiday, 토요일=saturday, 그 외 weekday)
 *
 * @param dateStr 날짜 "YYYY-MM-DD"
 * @param holidays 공휴일 날짜 집합(선택). Set 또는 Map 어느 쪽이든 `.has(dateStr)`로 조회한다.
 */
export function getDayType(dateStr: string, holidays?: Set<string> | Map<string, unknown>): DayType {
  const isHoliday = !!holidays && holidays.has(dateStr);
  if (isHoliday) return "holiday";
  const dow = new Date(dateStr + "T00:00:00").getDay();
  if (dow === 0) return "holiday"; // 일요일 = 유급주휴일(휴일)
  if (dow === 6) return "saturday"; // 토요일 = 무급휴무일
  return "weekday";
}

export interface LaborCalcInput {
  /** 근무 시작 시각 "HH:MM" */
  startTime: string;
  /** 근무 종료 시각 "HH:MM". 시작 이하이면 자정 넘김으로 본다(+24h). */
  endTime: string;
  dayType: DayType;
  /** 시간당 통상임금(원) */
  ordinaryWage: number;
  /** 8시간 판정 시작점(이미 근무한 시간). 평일 연장=8, 휴일/토/출장=0 */
  priorHours?: number;
  /** 휴게 시작 "HH:MM"(선택) */
  breakStart?: string | null;
  /** 휴게 종료 "HH:MM"(선택) */
  breakEnd?: string | null;
  /** 회사별 취업규칙 옵션(선택). 미지정 시 근로기준법 기본값. */
  workRule?: WorkRuleOptions;
}

export interface LaborCalcResult {
  workedHours: number; // 실 근무시간 (휴게 제외)
  weightedHours: number; // 배율 가중 시간 (Σ 배율 × 시간)
  amount: number; // 통상임금 × weightedHours (반올림, 원)
  dayHours: number; // 주간(06~22) 시간
  nightHours: number; // 야간(22~06) 시간
  effectiveRate: number; // 평균 배율 (weightedHours / workedHours), 0시간이면 0
}

const EMPTY: LaborCalcResult = {
  workedHours: 0, weightedHours: 0, amount: 0, dayHours: 0, nightHours: 0, effectiveRate: 0,
};

/**
 * 취업규칙 옵션을 반영해 실제 적용할 배율 행(row)을 고른다.
 * 토요일을 유급휴일로 취급하는 회사면 토요일에도 휴일(holiday) 배율을 쓴다.
 */
function resolveMultiplierDayType(dayType: DayType, workRule?: WorkRuleOptions): DayType {
  if (dayType === "saturday" && workRule?.saturdayType === "paid_holiday") return "holiday";
  return dayType;
}

/**
 * 근로기준법 배율을 분 단위로 적용해 가중 근로시간·수당을 계산한다.
 * 휴게시간이 근무구간과 겹치면 제외한다. 종료가 시작 이하이면 자정 넘김으로 처리(+24h).
 *
 * @returns 근무시간·가중시간·수당(원)·주야간 시간·평균 배율
 */
export function calcLaborPay(input: LaborCalcInput): LaborCalcResult {
  const { startTime, endTime, dayType, ordinaryWage } = input;
  if (!startTime || !endTime) return EMPTY;

  const start = toMin(startTime);
  let end = toMin(endTime);
  if (end === start) return EMPTY;
  if (end < start) end += 1440; // 자정 넘김

  const bStart = input.breakStart ? toMin(input.breakStart) : null;
  const bEnd = input.breakEnd ? toMin(input.breakEnd) : null;
  const hasBreak = bStart !== null && bEnd !== null && bEnd > bStart;

  const prior = Math.round((input.priorHours ?? 0) * 60);
  const mult = LABOR_MULTIPLIERS[resolveMultiplierDayType(dayType, input.workRule)];
  const nightStart = (input.workRule?.nightRange?.start ?? 22) * 60;
  const nightEnd = (input.workRule?.nightRange?.end ?? 6) * 60;

  let weightedMin = 0;
  let workedMin = 0;
  let dayMin = 0;
  let nightMin = 0;
  let cum = prior; // 8시간 판정용 누적 근무 분

  for (let m = start; m < end; m++) {
    // 휴게시간 제외 (같은 날 기준)
    if (hasBreak && m >= (bStart as number) && m < (bEnd as number)) continue;

    const night = isNightMinute(m, nightStart, nightEnd);
    const over8 = cum >= EIGHT_HOURS;
    const zone = night ? mult.night : mult.day;
    weightedMin += over8 ? zone.over : zone.within;
    workedMin += 1;
    if (night) nightMin++; else dayMin++;
    cum++;
  }

  const weightedHours = weightedMin / 60;
  const workedHours = workedMin / 60;
  return {
    workedHours,
    weightedHours,
    amount: Math.round(ordinaryWage * weightedHours),
    dayHours: dayMin / 60,
    nightHours: nightMin / 60,
    effectiveRate: workedHours > 0 ? weightedHours / workedHours : 0,
  };
}

/**
 * 일반 연장근로 수당 (근로기준법 기준).
 * 평일은 소정 8시간을 채운 초과근로이므로 priorHours=8, 토/일/공휴일은 0.
 *
 * @param params.ordinaryWage 시간당 통상임금(원)
 * @param params.workRule 회사별 취업규칙 옵션(선택)
 */
export function calcRegularOvertimePay(params: {
  date: string;
  startTime: string;
  endTime: string;
  ordinaryWage: number;
  dayType?: DayType;
  holidays?: Set<string> | Map<string, unknown>;
  breakStart?: string | null;
  breakEnd?: string | null;
  workRule?: WorkRuleOptions;
}): LaborCalcResult {
  const dayType = params.dayType ?? getDayType(params.date, params.holidays);
  return calcLaborPay({
    startTime: params.startTime,
    endTime: params.endTime,
    dayType,
    ordinaryWage: params.ordinaryWage,
    priorHours: dayType === "weekday" ? 8 : 0,
    breakStart: params.breakStart,
    breakEnd: params.breakEnd,
    workRule: params.workRule,
  });
}

export interface TripPayResult extends LaborCalcResult {
  rawAmount: number; // 최소금액 적용 전(원)
  minApplied: boolean; // 최소금액이 상향 적용되었는지
}

/**
 * 주말출장 수당 (근로기준법 배율 × 통상임금, 그날 처음부터 근로 → priorHours=0).
 * 계산액이 최소금액 이하이면 최소금액을 보장한다.
 *
 * @param params.ordinaryWage 시간당 통상임금(원)
 * @param params.minAmount 최소 보장금액(원)
 * @param params.workRule 회사별 취업규칙 옵션(선택)
 */
export function calcWeekendTripPay(params: {
  date: string;
  startTime: string;
  endTime: string;
  ordinaryWage: number;
  minAmount: number;
  dayType?: DayType;
  holidays?: Set<string> | Map<string, unknown>;
  workRule?: WorkRuleOptions;
}): TripPayResult {
  const dayType = params.dayType ?? getDayType(params.date, params.holidays);
  const base = calcLaborPay({
    startTime: params.startTime,
    endTime: params.endTime,
    dayType,
    ordinaryWage: params.ordinaryWage,
    priorHours: 0,
    workRule: params.workRule,
  });
  const rawAmount = base.amount;
  const amount = Math.max(rawAmount, params.minAmount);
  return { ...base, amount, rawAmount, minApplied: rawAmount < params.minAmount };
}
