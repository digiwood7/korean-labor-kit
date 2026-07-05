// 주말출장근무 공통 상수/헬퍼
// 실제 수당 계산은 ./laborPay.ts 의 calcWeekendTripPay(통상임금 × 근로기준법 배율)를 사용한다.
// 이 파일은 근무형태 식별값과 "최소 보장금액" 설정값 처리만 담당한다.

/** 근무형태 식별값(라벨) */
export const WEEKEND_TRIP_WORK_TYPE = "주말출장" as const;

/** 주말출장 최소 보장금액(원). 계산액이 이 값 이하이면 이 값을 지급한다. */
export const DEFAULT_WEEKEND_TRIP_MIN_AMOUNT = 80000;

/**
 * 회사 설정에서 주말출장 최소 보장금액(원)을 뽑아온다. 값이 없거나 0 이하이면 기본값(80,000원).
 *
 * @param settings 최소금액 설정 객체(선택). 예) 회사 설정 테이블의 한 행.
 * @returns 최소 보장금액(원)
 */
export function resolveTripMinAmount(
  settings?: { weekend_trip_min_amount?: number | null } | null,
): number {
  const v = settings?.weekend_trip_min_amount;
  return v && v > 0 ? v : DEFAULT_WEEKEND_TRIP_MIN_AMOUNT;
}
