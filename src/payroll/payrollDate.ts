/**
 * 급여월(월급날/연장근로 마감일/집계기간) 계산
 *
 * 원본의 lib/utils/payrollDate.ts를 이식했다. 원본은 내부에서 공휴일 API(lib/utils/holidays.ts)를
 * 직접 호출했지만, 이 모듈은 자기완결(다른 모듈에 의존하지 않음)이어야 하므로 공휴일 판정을
 * `isHoliday` 콜백으로 주입받는다. 콜백을 안 주면 "주말만 휴무"로 계산한다.
 * 공휴일까지 반영하려면 이 킷의 `src/holidays`(HolidayClient)나 자체 함수를 콜백으로 넘기면 된다:
 *
 * ```ts
 * const holidays = new HolidayClient({ apiKey: process.env.HOLIDAY_API_KEY });
 * await getPayday(2026, 3, { isHoliday: (d) => holidays.isHoliday(d) });
 * ```
 *
 * 날짜 계산은 전부 UTC 캘린더 필드(Date.UTC, getUTCDay 등)로만 하므로 실행 환경의 시간대와
 * 무관하게 항상 같은 결과가 나온다.
 */

export interface PayrollDateOptions {
  /**
   * 주말 외에 추가로 휴무로 처리할 날짜를 판정하는 함수(공휴일 등).
   * 인자로 받는 Date는 UTC 자정으로 만든 해당 날짜다. 기본값: 항상 false(주말만 휴무).
   */
  isHoliday?: (date: Date) => boolean | Promise<boolean>;
}

function makeUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, delta: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function isRestDay(date: Date, options?: PayrollDateOptions): Promise<boolean> {
  if (isWeekendUtc(date)) return true;
  if (options?.isHoliday) return await options.isHoliday(date);
  return false;
}

/**
 * 해당 월의 월급날을 계산한다.
 * 규칙: 기본 월급날은 매월 25일. 25일이 휴무(주말/공휴일)면 그 이전의 가장 가까운 평일로 이동.
 *
 * @param year 연도
 * @param month 월 (1-12)
 */
export async function getPayday(year: number, month: number, options?: PayrollDateOptions): Promise<Date> {
  let payday = makeUtcDate(year, month, 25);
  while (await isRestDay(payday, options)) {
    payday = addUtcDays(payday, -1);
  }
  return payday;
}

/**
 * 해당 월의 연장근로 마감일을 계산한다.
 * 규칙: 연장근로 마감일 = 월급날 - 1일
 */
export async function getOvertimeClosingDate(
  year: number,
  month: number,
  options?: PayrollDateOptions,
): Promise<Date> {
  const payday = await getPayday(year, month, options);
  return addUtcDays(payday, -1);
}

export interface OvertimePeriod {
  /** 집계 시작일 "YYYY-MM-DD" */
  startDate: string;
  /** 집계 종료일(= 이번달 마감일) "YYYY-MM-DD" */
  endDate: string;
  /** 월급날 "YYYY-MM-DD" */
  payday: string;
}

/**
 * 해당 월의 연장근로 집계 기간을 계산한다.
 * 집계 기간 = 이전달 마감일 + 1일 ~ 이번달 마감일
 */
export async function getOvertimePeriod(
  year: number,
  month: number,
  options?: PayrollDateOptions,
): Promise<OvertimePeriod> {
  const currentClosingDate = await getOvertimeClosingDate(year, month, options);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevClosingDate = await getOvertimeClosingDate(prevYear, prevMonth, options);

  const startDate = addUtcDays(prevClosingDate, 1);
  const payday = await getPayday(year, month, options);

  return {
    startDate: formatUtcDate(startDate),
    endDate: formatUtcDate(currentClosingDate),
    payday: formatUtcDate(payday),
  };
}

/**
 * 특정 날짜(YYYY-MM-DD)가 어느 급여연월(집계기간)에 속하는지 계산한다.
 */
export async function getPayrollMonth(
  dateStr: string,
  options?: PayrollDateOptions,
): Promise<{ year: number; month: number }> {
  const [yearStr, monthStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const currentPeriod = await getOvertimePeriod(year, month, options);
  if (dateStr >= currentPeriod.startDate && dateStr <= currentPeriod.endDate) {
    return { year, month };
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextPeriod = await getOvertimePeriod(nextYear, nextMonth, options);
  if (dateStr >= nextPeriod.startDate && dateStr <= nextPeriod.endDate) {
    return { year: nextYear, month: nextMonth };
  }

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return { year: prevYear, month: prevMonth };
}
