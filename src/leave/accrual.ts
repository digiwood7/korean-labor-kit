/**
 * 연차 발생 로직 (순수 함수, DB 의존 없음)
 */

import {
  MAX_LEAVE_LIMIT,
  MAX_LEAVE_FIRST_YEAR,
  BASE_LEAVE_DAYS,
  ADDITIONAL_LEAVE_START_YEAR,
  ADDITIONAL_LEAVE_CYCLE,
} from "./constants.js";
import { getMonthsDifference, getYearsDifference, parseDate } from "./utils.js";

/**
 * Date를 로컬(설정 시간대) 기준 "YYYY-MM-DD"로 변환한다.
 * `parseDate`가 로컬 자정 + 로컬 세터(setFullYear/setDate)로 날짜를 조립하므로,
 * 출력 포맷도 `toISOString()`(UTC) 대신 로컬 게터로 통일해야 어느 타임존에서든
 * 같은 날짜 문자열이 나온다(src/holidays/holidays.ts의 formatLocalDate와 동일 패턴).
 */
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 1년 미만 근무자의 연차 계산
 * - 연차 기준일 이후 1개월 초과시 연차 1개 발생 (월수로 계산)
 * - 최대 한도 11개
 *
 * @param leaveStartDate 연차 산정 기준일
 * @param targetDate 기준일 (보통 현재 날짜)
 * @returns 발생한 연차 일수
 */
export function calculateFirstYearLeave(
  leaveStartDate: string,
  targetDate: Date = new Date(),
): number {
  const startDate = parseDate(leaveStartDate);
  const monthsWorked = getMonthsDifference(startDate, targetDate);

  // 1개월 초과부터 연차 발생 (예: 2개월 근무 시 1개, 3개월 근무 시 2개)
  const earnedDays = monthsWorked > 0 ? monthsWorked : 0;

  // 최대 11개로 제한
  return Math.min(earnedDays, MAX_LEAVE_FIRST_YEAR);
}

/**
 * 1년 이상 근무자의 연차 계산
 * - 기본 15개 생성
 * - 3년차부터 매 2년마다 1개씩 가산
 * - 계산식: 15 + floor((근속년수 - 1) / 2)
 * - 최대 한도 25개
 *
 * @param leaveStartDate 연차 산정 기준일
 * @param targetDate 기준일 (보통 현재 날짜)
 * @returns 발생한 연차 일수
 */
export function calculateRegularLeave(
  leaveStartDate: string,
  targetDate: Date = new Date(),
): number {
  const startDate = parseDate(leaveStartDate);
  const yearsWorked = getYearsDifference(startDate, targetDate);

  // 1년 미만이면 0 반환
  if (yearsWorked < 1) {
    return 0;
  }

  // 기본 연차
  let totalDays = BASE_LEAVE_DAYS;

  // 3년차부터 가산 연차 적용
  if (yearsWorked >= ADDITIONAL_LEAVE_START_YEAR) {
    const additionalYears = yearsWorked - ADDITIONAL_LEAVE_START_YEAR; // 3년차부터 계산
    const additionalDays = Math.floor(additionalYears / ADDITIONAL_LEAVE_CYCLE) + 1;
    totalDays += additionalDays;
  }

  // 최대 한도로 제한
  return Math.min(totalDays, MAX_LEAVE_LIMIT);
}

/**
 * 특정 주기에 직원이 사용할 수 있는 총 발생 연차 계산
 * 연차 기준일 기준 12개월 단위로 계산
 *
 * 예시:
 * - 기준일: 2025-06-01, cycleYear: 1 → 1차년도 (2025-06-01 ~ 2026-05-31) 월수 계산
 * - 기준일: 2025-06-01, cycleYear: 2 → 2차년도 (2026-06-01 ~ 2027-05-31) 15개 발생
 *
 * @param leaveStartDate 연차 산정 기준일 (YYYY-MM-DD)
 * @param cycleYear 주기 연도 (1, 2, 3, ...)
 * @returns 발생한 연차 일수
 */
export function calculateTotalLeaveByCycle(
  leaveStartDate: string,
  cycleYear: number,
): number {
  const startDate = parseDate(leaveStartDate);

  // 주기의 종료일 계산
  const cycleEndDate = new Date(startDate);
  cycleEndDate.setFullYear(startDate.getFullYear() + cycleYear);
  cycleEndDate.setDate(cycleEndDate.getDate() - 1); // 1일 전

  // 1차년도 (cycleYear === 1)
  if (cycleYear === 1) {
    return calculateFirstYearLeave(leaveStartDate, cycleEndDate);
  }

  // 2차년도 이상 (cycleYear >= 2)
  return calculateRegularLeave(leaveStartDate, cycleEndDate);
}

/**
 * 연차 계산 상세 정보 반환 (디버깅/로그용)
 *
 * @param leaveStartDate 연차 산정 기준일
 * @param cycleYear 주기 연도
 * @returns 연차 계산 상세 정보
 */
export function getLeaveCalculationDetails(
  leaveStartDate: string,
  cycleYear: number,
): {
  leaveStartDate: string;
  cycleYear: number;
  cycleStartDate: string;
  cycleEndDate: string;
  yearsWorked: number;
  monthsWorked: number;
  isFirstYear: boolean;
  totalDays: number;
  calculationMethod: string;
} {
  const startDate = parseDate(leaveStartDate);

  // 주기 시작일과 종료일
  const cycleStartDate = new Date(startDate);
  cycleStartDate.setFullYear(startDate.getFullYear() + (cycleYear - 1));

  const cycleEndDate = new Date(cycleStartDate);
  cycleEndDate.setFullYear(cycleStartDate.getFullYear() + 1);
  cycleEndDate.setDate(cycleEndDate.getDate() - 1);

  const yearsWorked = cycleYear - 1; // 1차년도 = 0년 근무, 2차년도 = 1년 근무
  const monthsWorked = getMonthsDifference(startDate, cycleEndDate);
  const isFirstYear = cycleYear === 1;

  const totalDays = calculateTotalLeaveByCycle(leaveStartDate, cycleYear);

  let calculationMethod = "";
  if (isFirstYear) {
    calculationMethod = `1차년도: 월수(${monthsWorked}) → ${totalDays}일 (최대 ${MAX_LEAVE_FIRST_YEAR}일)`;
  } else {
    const additionalYears = yearsWorked >= ADDITIONAL_LEAVE_START_YEAR
      ? yearsWorked - ADDITIONAL_LEAVE_START_YEAR
      : 0;
    const additionalDays = yearsWorked >= ADDITIONAL_LEAVE_START_YEAR
      ? Math.floor(additionalYears / ADDITIONAL_LEAVE_CYCLE) + 1
      : 0;
    calculationMethod = `${cycleYear}차년도: 기본 ${BASE_LEAVE_DAYS}일 + 가산 ${additionalDays}일 = ${totalDays}일 (최대 ${MAX_LEAVE_LIMIT}일)`;
  }

  return {
    leaveStartDate,
    cycleYear,
    cycleStartDate: formatLocalDate(cycleStartDate),
    cycleEndDate: formatLocalDate(cycleEndDate),
    yearsWorked,
    monthsWorked,
    isFirstYear,
    totalDays,
    calculationMethod,
  };
}
