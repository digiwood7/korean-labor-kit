import { describe, expect, it } from "vitest";
import { healthLeaveDeduction, DAILY_WORKING_HOURS } from "./healthLeave.js";

/**
 * 원본의 lib/leave/healthLeave.test.ts(node:test)를 vitest로 이식했다. 산식은 원본과 동일하다.
 */
describe("healthLeaveDeduction (기존 이식)", () => {
  it("통상임금 × 8시간으로 1일 공제액을 계산한다", () => {
    // 예시: 시간당 통상임금 15,072원 → 1일 공제 = 15,072 × 8 = 120,576원
    expect(healthLeaveDeduction(15072)).toBe(120576);
  });

  it("소수점은 반올림한다", () => {
    // 15072.4 × 8 = 120579.2 → 120579
    expect(healthLeaveDeduction(15072.4)).toBe(120579);
  });

  it("통상임금이 없으면(0/null/undefined) 0을 반환한다", () => {
    expect(healthLeaveDeduction(0)).toBe(0);
    expect(healthLeaveDeduction(null)).toBe(0);
    expect(healthLeaveDeduction(undefined)).toBe(0);
  });

  it("음수 통상임금은 0으로 처리한다", () => {
    expect(healthLeaveDeduction(-100)).toBe(0);
  });

  it("1일 소정근로시간은 8시간이다", () => {
    expect(DAILY_WORKING_HOURS).toBe(8);
  });
});
