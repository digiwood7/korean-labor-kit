/**
 * 예제: 연장·야간·휴일 근로수당 계산
 *
 * 실행: npx tsx examples/overtime.ts
 *
 * 통상임금(시간당) 15,072원을 기준으로 몇 가지 상황의 수당을 계산해 본다.
 * 취업규칙 옵션(토요일 유급/무급)이 결과를 어떻게 바꾸는지도 비교한다.
 */
import {
  calcRegularOvertimePay,
  calcWeekendTripPay,
} from "../src/overtime/index";

const wage = 15072; // 시간당 통상임금(원) — 가상 값

function line(label: string, r: { weightedHours: number; amount: number }): void {
  console.log(
    `${label.padEnd(34)} 가중시간 ${String(r.weightedHours).padStart(5)}h  →  ${r.amount.toLocaleString("ko-KR")}원`,
  );
}

console.log("=== 연장·야간·휴일 근로수당 (통상임금 시급 " + wage.toLocaleString("ko-KR") + "원) ===\n");

// 1) 평일 연장근로 18:00~20:00 (소정 8h 채운 뒤 초과 → 1.5배)
line(
  "평일 연장 18:00~20:00",
  calcRegularOvertimePay({ date: "2026-06-15", startTime: "18:00", endTime: "20:00", ordinaryWage: wage }),
);

// 2) 평일 야간까지 이어지는 연장 20:00~24:00 (22시 이후 2.0배)
line(
  "평일 연장+야간 20:00~24:00",
  calcRegularOvertimePay({ date: "2026-06-15", startTime: "20:00", endTime: "24:00", ordinaryWage: wage }),
);

// 3) 일요일(휴일) 근로 09:00~18:00 (처음부터 근로 → priorHours=0, 휴일 배율)
line(
  "일요일 근로 09:00~18:00",
  calcRegularOvertimePay({ date: "2026-06-14", startTime: "09:00", endTime: "18:00", ordinaryWage: wage }),
);

// 4) 주말출장 (최소 8만원 보장)
const trip = calcWeekendTripPay({
  date: "2026-06-14",
  startTime: "09:00",
  endTime: "12:00",
  ordinaryWage: wage,
  minAmount: 80000,
});
line("주말출장 09:00~12:00 (최소 8만원)", trip);
console.log(
  `   ↳ 계산액 ${trip.rawAmount.toLocaleString("ko-KR")}원 → ` +
    (trip.minApplied ? "최소금액 80,000원으로 상향" : "계산액 그대로 적용"),
);

console.log("\n--- 취업규칙 옵션 비교: 토요일 근로 09:00~19:00 (휴게 12~13시) ---");
const satArgs = {
  date: "2026-06-13", // 토요일
  startTime: "09:00",
  endTime: "19:00",
  ordinaryWage: wage,
  breakStart: "12:00",
  breakEnd: "13:00",
} as const;

line("토요일=무급휴무일(기본)", calcRegularOvertimePay({ ...satArgs }));
line(
  "토요일=유급휴일(옵션)",
  calcRegularOvertimePay({ ...satArgs, workRule: { saturdayType: "paid_holiday" } }),
);
console.log("\n같은 근무라도 취업규칙에 따라 수당이 달라진다.");
