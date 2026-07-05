/**
 * 연차 계산 유틸리티 함수 (순수 함수, DB 의존 없음)
 */

/**
 * 두 날짜 사이의 월수 차이 계산
 * @param startDate 시작일
 * @param endDate 종료일
 * @returns 월수 차이 (소수점 이하 버림)
 */
export function getMonthsDifference(startDate: Date, endDate: Date): number {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

/**
 * 두 날짜 사이의 년수 차이 계산
 * @param startDate 시작일
 * @param endDate 종료일
 * @returns 근속년수 (소수점 이하 버림)
 */
export function getYearsDifference(startDate: Date, endDate: Date): number {
  let years = endDate.getFullYear() - startDate.getFullYear();

  // 월/일 비교하여 아직 1년이 안 된 경우 조정
  if (
    endDate.getMonth() < startDate.getMonth() ||
    (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate())
  ) {
    years--;
  }

  return years;
}

/**
 * 날짜 문자열을 Date 객체로 변환
 *
 * `new Date(dateString)`으로 그대로 파싱하면 UTC 자정으로 해석되어, 이 파일의
 * `getMonthsDifference`/`getYearsDifference`가 쓰는 로컬 게터(getFullYear/getMonth/getDate)와
 * 짝이 안 맞는다 — 음수 오프셋 타임존(예: America/New_York)에서 로컬 날짜가 하루 전날로
 * 밀려 월수/연수 계산이 어긋난다. 문자열을 분해해 로컬 자정으로 직접 생성하면 타임존에
 * 관계없이 로컬 게터/세터와 항상 같은 달력 날짜를 가리킨다.
 *
 * @param dateString YYYY-MM-DD 형식의 날짜 문자열
 * @returns Date 객체 (로컬 자정)
 */
export function parseDate(dateString: string): Date {
  const [y, m, d] = dateString.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 연차 기준일 기준으로 현재 주기 연도 계산
 * 예: leaveStartDate가 2025-06-01이고 현재가 2026-05-31이면 → 1차년도 (cycleYear: 1)
 * 예: leaveStartDate가 2025-06-01이고 현재가 2026-06-01이면 → 2차년도 (cycleYear: 2)
 *
 * @param leaveStartDate 연차 산정 기준일 (YYYY-MM-DD)
 * @param targetDate 대상 날짜 (기본값: 현재 날짜)
 * @returns 연차 주기 연도 (1부터 시작). 기준일이 대상 날짜보다 미래이면 0.
 */
export function getLeaveCycleYear(
  leaveStartDate: string,
  targetDate: Date = new Date(),
): number {
  const startDate = parseDate(leaveStartDate);

  // 기준일이 대상 날짜보다 미래인 경우 0 반환
  if (startDate > targetDate) {
    return 0;
  }

  const yearsWorked = getYearsDifference(startDate, targetDate);

  // 1차년도는 cycleYear 1, 2차년도는 cycleYear 2
  return yearsWorked + 1;
}

/**
 * 특정 주기의 시작일과 종료일 계산
 *
 * @param leaveStartDate 연차 산정 기준일 (YYYY-MM-DD)
 * @param cycleYear 주기 연도 (1, 2, 3, ...)
 * @returns { startDate: Date, endDate: Date }
 */
export function getLeaveCyclePeriod(
  leaveStartDate: string,
  cycleYear: number,
): { startDate: Date; endDate: Date } {
  const startDate = parseDate(leaveStartDate);

  // 주기 시작일: leaveStartDate + (cycleYear - 1) years
  const cycleStartDate = new Date(startDate);
  cycleStartDate.setFullYear(startDate.getFullYear() + (cycleYear - 1));

  // 주기 종료일: 시작일 + 1년 - 1일
  const cycleEndDate = new Date(cycleStartDate);
  cycleEndDate.setFullYear(cycleStartDate.getFullYear() + 1);
  cycleEndDate.setDate(cycleEndDate.getDate() - 1);

  return {
    startDate: cycleStartDate,
    endDate: cycleEndDate,
  };
}
