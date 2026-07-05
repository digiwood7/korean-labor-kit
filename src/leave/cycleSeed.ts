/**
 * 새 연차 주기의 초기값 계산 (순수 함수, DB 의존 없음)
 *
 * 화면 잔여 계산이 `total_days - (그 주기 승인휴가 합계)` 이고 used_days를
 * 참조하지 않는 설계에서는, 전년도 이월 빚을 used_days가 아니라 **발생량(total)에서
 * 차감**해 저장해야 한다. 그래야 기존 화면/다른 직원 데이터를 건드리지 않고
 * 이월이 잔여에 정확히 반영된다.
 */
import { calculateTotalLeaveByCycle } from "./accrual";

export interface NewCycleSeed {
  grant: number;     // 공식 발생량(총)
  carryDebt: number; // 전년도 당겨쓴 빚(음수 잔여) 이월 차감액
  total: number;     // 실제 부여 = grant - carryDebt (저장할 total_days)
  used: number;      // 0 (이후 휴가사용은 휴가신청/트리거가 처리)
}

/**
 * @param params.leaveStartDate 연차 산정 기준일 (YYYY-MM-DD)
 * @param params.currentCycle 새로 시작하는 주기 연도 (2, 3, ...)
 * @param params.prevRemaining 직전 주기 잔여 (발생량 - 사용량). 음수면 당겨쓴 빚.
 */
export function computeNewCycleSeed(params: {
  leaveStartDate: string;
  currentCycle: number;
  prevRemaining: number;
}): NewCycleSeed {
  const grant = calculateTotalLeaveByCycle(params.leaveStartDate, params.currentCycle);
  const rawDebt = params.prevRemaining < 0 ? -params.prevRemaining : 0;
  const carryDebt = Math.round(rawDebt * 2) / 2; // 0.5 단위 반올림
  const total = grant - carryDebt;
  return { grant, carryDebt, total, used: 0 };
}
