/**
 * 보건휴가(무급) 급여 공제 계산
 *
 * 근로기준법 제73조: 사용자는 여성 근로자가 청구하면 월 1일의 (보건)휴가를 주어야 한다.
 * 2004년 주 40시간제 도입 이후 무급이므로, 사용 시 1일분 임금을 공제한다.
 * (개인 프라이버시 보호를 위해 화면 명칭은 '보건휴가(무급)'으로 표기하는 것을 권장한다)
 *
 * 1일 공제액 = 시간당 통상임금 × 1일 소정근로시간(8h)
 *   (시간당 통상임금 = (기본급 + 식대 + 자가운전보조금) ÷ 209 로 산정하는 것이 일반적이다)
 */

// 1일 소정근로시간 (주 40시간 / 주 5일)
export const DAILY_WORKING_HOURS = 8;

/**
 * 보건휴가 1일 사용 시 급여 공제액 (원, 반올림)
 *
 * @param ordinaryWage 시간당 통상임금(원)
 * @returns 공제액(원). 통상임금이 없거나 0 이하이면 0.
 */
export function healthLeaveDeduction(ordinaryWage: number | null | undefined): number {
  if (!ordinaryWage || ordinaryWage <= 0) return 0;
  return Math.round(ordinaryWage * DAILY_WORKING_HOURS);
}
