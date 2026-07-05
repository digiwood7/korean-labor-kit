import { describe, expect, it } from "vitest";
import {
  calcLaborPay,
  calcRegularOvertimePay,
  calcWeekendTripPay,
  getDayType,
} from "./laborPay.js";

/**
 * 원본의 lib/overtime/laborPay.test.ts(node:test)를 vitest로 이식했다.
 * "기존 이식" 블록은 원본 단언을 그대로 옮긴 것으로, 옵션을 주지 않은 기본 동작이
 * 원본과 100% 동일함을 증명한다. 그 아래 "옵션 분기"는 이번에 추가한 취업규칙 옵션 테스트다.
 */

const WAGE = 10000; // 통상임금 시급 1만원 (계산 검증용)

describe("기존 이식 — 옵션 없이 근로기준법 기본값(원본과 동일)", () => {
  // ── getDayType ────────────────────────────────
  it("getDayType: 토요일/일요일/평일/공휴일 판정", () => {
    expect(getDayType("2026-06-06")).toBe("saturday"); // 토요일 (공휴일 미지정 시 요일 기준)
    expect(getDayType("2026-06-06", new Set(["2026-06-06"]))).toBe("holiday"); // 공휴일(현충일)이면 휴일
    expect(getDayType("2026-06-13")).toBe("saturday"); // 토요일
    expect(getDayType("2026-06-14")).toBe("holiday"); // 일요일
    expect(getDayType("2026-06-15")).toBe("weekday"); // 월요일
  });

  // ── 평일 일반 연장근로 (priorHours=8, 초과) ──────
  it("평일 연장 주간 18:00~20:00 = 2h × 1.5 = 배율가중 3h", () => {
    const r = calcRegularOvertimePay({ date: "2026-06-15", startTime: "18:00", endTime: "20:00", ordinaryWage: WAGE });
    expect(r.workedHours).toBe(2);
    expect(r.weightedHours).toBe(3); // 2 × 1.5
    expect(r.amount).toBe(30000);
  });

  it("평일 연장 야간 포함 21:00~24:00 = 주간1h×1.5 + 야간2h×2.0 = 1.5+4=5.5", () => {
    const r = calcRegularOvertimePay({ date: "2026-06-15", startTime: "21:00", endTime: "24:00", ordinaryWage: WAGE });
    expect(r.dayHours).toBe(1); // 21~22
    expect(r.nightHours).toBe(2); // 22~24
    expect(r.weightedHours).toBe(5.5);
    expect(r.amount).toBe(55000);
  });

  // ── 토요일(무급휴무일): 주간 1.5, 야간 2.0, 8h 구분 없음 ──
  it("토요일 09:00~19:00(휴게12~13 제외 9h): 전부 주간이면 9h×1.5=13.5", () => {
    const r = calcRegularOvertimePay({ date: "2026-06-13", startTime: "09:00", endTime: "19:00", ordinaryWage: WAGE, breakStart: "12:00", breakEnd: "13:00" });
    expect(r.workedHours).toBe(9); // 10h - 1h 휴게
    expect(r.weightedHours).toBe(13.5); // 9 × 1.5
  });

  // ── 일요일/휴일: 8h이내 1.5, 초과 2.0 (주간) ──────
  it("일요일 09:00~19:00(휴게1h, 9h근무): 8h×1.5 + 1h×2.0 = 12+2=14", () => {
    const r = calcRegularOvertimePay({ date: "2026-06-14", startTime: "09:00", endTime: "19:00", ordinaryWage: WAGE, breakStart: "12:00", breakEnd: "13:00" });
    expect(r.workedHours).toBe(9);
    expect(r.weightedHours).toBe(14); // 8×1.5 + 1×2.0
    expect(r.amount).toBe(140000);
  });

  // ── 주말출장 (priorHours=0, 최소금액 보장) ─────────
  it("주말출장 일요일 09:00~18:00 = 8h×1.5 + 1h×2.0 = 14h가중, 통상 15072원 → 211,008원", () => {
    const r = calcWeekendTripPay({ date: "2026-06-14", startTime: "09:00", endTime: "18:00", ordinaryWage: 15072, minAmount: 80000 });
    expect(r.weightedHours).toBe(14); // 8×1.5 + 1×2.0
    expect(r.rawAmount).toBe(Math.round(15072 * 14)); // 211008
    expect(r.amount).toBe(211008);
    expect(r.minApplied).toBe(false);
  });

  it("주말출장 짧은 근무 → 최소 8만원 보장", () => {
    // 토요일 09:00~10:00 = 1h × 1.5 = 1.5h가중 × 10000 = 15000 → 최소 80000
    const r = calcWeekendTripPay({ date: "2026-06-13", startTime: "09:00", endTime: "10:00", ordinaryWage: WAGE, minAmount: 80000 });
    expect(r.rawAmount).toBe(15000);
    expect(r.amount).toBe(80000);
    expect(r.minApplied).toBe(true);
  });

  it("주말출장 통상임금 0(미설정) → 최소 8만원", () => {
    const r = calcWeekendTripPay({ date: "2026-06-14", startTime: "09:00", endTime: "18:00", ordinaryWage: 0, minAmount: 80000 });
    expect(r.rawAmount).toBe(0);
    expect(r.amount).toBe(80000);
    expect(r.minApplied).toBe(true);
  });

  // ── calcLaborPay 경계/입력 방어 ──────────────────
  it("종료==시작 또는 빈 입력 → 0", () => {
    expect(calcLaborPay({ startTime: "18:00", endTime: "18:00", dayType: "weekday", ordinaryWage: WAGE }).amount).toBe(0);
    expect(calcLaborPay({ startTime: "", endTime: "18:00", dayType: "weekday", ordinaryWage: WAGE }).amount).toBe(0);
  });

  it("자정 넘김 22:00~00:00(=24:00) 평일 = 야간2h×2.0 = 4h가중", () => {
    const r = calcLaborPay({ startTime: "22:00", endTime: "00:00", dayType: "weekday", ordinaryWage: WAGE, priorHours: 8 });
    expect(r.nightHours).toBe(2);
    expect(r.weightedHours).toBe(4); // 2 × 2.0
  });
});

describe("옵션 분기 — saturdayType", () => {
  it("기본(unpaid_holiday): 토요일 9h = 9×1.5 = 13.5 (원본과 동일)", () => {
    const r = calcRegularOvertimePay({
      date: "2026-06-13", startTime: "09:00", endTime: "19:00", ordinaryWage: WAGE,
      breakStart: "12:00", breakEnd: "13:00",
    });
    expect(r.weightedHours).toBe(13.5);
  });

  it("paid_holiday: 같은 토요일 9h가 일요일/휴일 열로 바뀌어 8×1.5+1×2.0 = 14", () => {
    const r = calcRegularOvertimePay({
      date: "2026-06-13", startTime: "09:00", endTime: "19:00", ordinaryWage: WAGE,
      breakStart: "12:00", breakEnd: "13:00",
      workRule: { saturdayType: "paid_holiday" },
    });
    expect(r.workedHours).toBe(9);
    expect(r.weightedHours).toBe(14); // 8×1.5 + 1×2.0
    expect(r.amount).toBe(140000);
  });

  it("paid_holiday 옵션은 토요일에만 영향 (평일/일요일은 그대로)", () => {
    // 평일: 옵션 유무와 무관하게 동일해야 한다
    const weekdayDefault = calcRegularOvertimePay({ date: "2026-06-15", startTime: "18:00", endTime: "20:00", ordinaryWage: WAGE });
    const weekdayPaid = calcRegularOvertimePay({ date: "2026-06-15", startTime: "18:00", endTime: "20:00", ordinaryWage: WAGE, workRule: { saturdayType: "paid_holiday" } });
    expect(weekdayPaid.weightedHours).toBe(weekdayDefault.weightedHours);
  });

  it("paid_holiday 주말출장 토요일도 휴일 배율 + 최소금액 보장 적용", () => {
    // 토요일 09:00~18:00(휴게 없음) 9h → 8×1.5+1×2.0 = 14h가중, 통상 10000 → 140000
    const r = calcWeekendTripPay({
      date: "2026-06-13", startTime: "09:00", endTime: "18:00", ordinaryWage: WAGE, minAmount: 80000,
      workRule: { saturdayType: "paid_holiday" },
    });
    expect(r.weightedHours).toBe(14);
    expect(r.amount).toBe(140000);
    expect(r.minApplied).toBe(false);
  });
});

describe("옵션 분기 — nightRange", () => {
  it("기본(22~06): 평일 22:00~24:00(초과) = 야간 2h×2.0 = 4", () => {
    const r = calcLaborPay({ startTime: "22:00", endTime: "00:00", dayType: "weekday", ordinaryWage: WAGE, priorHours: 8 });
    expect(r.nightHours).toBe(2);
    expect(r.weightedHours).toBe(4);
  });

  it("야간 시작을 23시로 늦추면 22~23은 주간이 된다: 22~24(초과) = 1h×1.5(주간) + 1h×2.0(야간) = 3.5", () => {
    const r = calcLaborPay({
      startTime: "22:00", endTime: "00:00", dayType: "weekday", ordinaryWage: WAGE, priorHours: 8,
      workRule: { nightRange: { start: 23, end: 6 } },
    });
    expect(r.dayHours).toBe(1); // 22~23 주간
    expect(r.nightHours).toBe(1); // 23~24 야간
    expect(r.weightedHours).toBe(3.5); // 1×1.5 + 1×2.0
  });

  it("자정 안 넘는 야간 구간(start<end)도 지원: {start:0,end:6} → 05:00~07:00 중 05~06만 야간", () => {
    // 평일 초과 근로 05:00~07:00: 05~06 야간(2.0), 06~07 주간(1.5) = 2.0+1.5 = 3.5
    const r = calcLaborPay({
      startTime: "05:00", endTime: "07:00", dayType: "weekday", ordinaryWage: WAGE, priorHours: 8,
      workRule: { nightRange: { start: 0, end: 6 } },
    });
    expect(r.nightHours).toBe(1); // 05~06
    expect(r.dayHours).toBe(1); // 06~07
    expect(r.weightedHours).toBe(3.5);
  });
});
