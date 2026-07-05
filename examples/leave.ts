/**
 * 예제: 연차(연차유급휴가) 계산
 *
 * 실행: npx tsx examples/leave.ts
 *
 * 연차 기준일(입사일)만 있으면 현재 차년도·발생일수·새 주기 초기값(이월 차감)을 계산할 수 있다.
 */
import {
  getLeaveCycleYear,
  calculateTotalLeaveByCycle,
  computeNewCycleSeed,
  healthLeaveDeduction,
} from "../src/leave/index";

const leaveStartDate = "2021-03-02"; // 연차 산정 기준일(입사일 등)

// targetDate로 Date를 넘길 땐 "로컬 자정"으로 만든다(타임존 어긋남 방지).
// 아래 두 방법 모두 로컬 자정: new Date(y, m-1, d)  또는  new Date("YYYY-MM-DDT00:00:00")
const today = new Date(2026, 6, 5); // 2026-07-05 로컬 자정

console.log("=== 연차 계산 (기준일 " + leaveStartDate + ", 대상일 2026-07-05) ===\n");

const cycle = getLeaveCycleYear(leaveStartDate, today);
console.log(`현재 차년도(cycleYear)   : ${cycle}차년도`);

const grant = calculateTotalLeaveByCycle(leaveStartDate, cycle);
console.log(`이번 주기 발생 연차       : ${grant}일`);

console.log("\n--- 차년도별 발생 연차 표 ---");
for (let c = 1; c <= 8; c++) {
  console.log(`  ${c}차년도 : ${calculateTotalLeaveByCycle(leaveStartDate, c)}일`);
}

console.log("\n--- 새 주기 초기값(전년도 이월 차감) ---");
// 전년도에 0.5일을 당겨 썼다면(잔여 -0.5) 새 주기 발생량에서 그만큼 차감된다.
const seed = computeNewCycleSeed({ leaveStartDate, currentCycle: cycle, prevRemaining: -0.5 });
console.log(`  공식 발생량(grant)      : ${seed.grant}일`);
console.log(`  이월 차감(carryDebt)    : ${seed.carryDebt}일`);
console.log(`  실제 부여(total)        : ${seed.total}일`);

console.log("\n--- 보건휴가(무급) 1일 급여 공제 ---");
const wage = 15072; // 시간당 통상임금(원)
console.log(`  시급 ${wage.toLocaleString("ko-KR")}원 × 8h = ${healthLeaveDeduction(wage).toLocaleString("ko-KR")}원 공제`);
