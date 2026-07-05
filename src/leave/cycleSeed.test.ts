import { describe, expect, it } from "vitest";
import { computeNewCycleSeed } from "./cycleSeed.js";

/**
 * 원본의 lib/leave/cycleSeed.test.ts(node:test)를 vitest로 이식했다.
 * 산식은 원본과 동일하며, 이 단언들이 이월 차감/가산 계산의 동작 보존을 증명한다.
 * (직원 실명이 들어갔던 원본 주석은 가상 설명으로 바꿨다 — 공개 repo 데이터 위생)
 */
describe("computeNewCycleSeed (기존 이식)", () => {
  it("음수 잔여(당겨씀)는 발생량에서 차감된다", () => {
    // 기준일 2024-06-01, 3차 진입, 직전(2차) 잔여 -0.5
    // → 발생 15, 이월차감 0.5, 실제부여(total) 14.5, used 0
    const seed = computeNewCycleSeed({
      leaveStartDate: "2024-06-01",
      currentCycle: 3,
      prevRemaining: -0.5,
    });
    expect(seed.grant).toBe(15);
    expect(seed.carryDebt).toBe(0.5);
    expect(seed.total).toBe(14.5);
    expect(seed.used).toBe(0);
  });

  it("양수 잔여(남음)는 이월되지 않는다", () => {
    const seed = computeNewCycleSeed({
      leaveStartDate: "2024-06-01",
      currentCycle: 3,
      prevRemaining: 3,
    });
    expect(seed.grant).toBe(15);
    expect(seed.carryDebt).toBe(0);
    expect(seed.total).toBe(15);
    expect(seed.used).toBe(0);
  });

  it("잔여 0이면 차감 0", () => {
    const seed = computeNewCycleSeed({
      leaveStartDate: "2022-01-01",
      currentCycle: 2,
      prevRemaining: 0,
    });
    expect(seed.carryDebt).toBe(0);
    expect(seed.total).toBe(15);
  });

  it("가산 연차: 5차년도는 발생 16", () => {
    // 기준일 2022-01-01, 5차(근속4년) → grant 16
    const seed = computeNewCycleSeed({
      leaveStartDate: "2022-01-01",
      currentCycle: 5,
      prevRemaining: 0,
    });
    expect(seed.grant).toBe(16);
    expect(seed.total).toBe(16);
  });

  it("이월차감은 0.5 단위로 정리된다 (부동소수 노이즈 방지)", () => {
    const seed = computeNewCycleSeed({
      leaveStartDate: "2024-06-01",
      currentCycle: 3,
      prevRemaining: -0.4999999,
    });
    expect(seed.carryDebt).toBe(0.5);
    expect(seed.total).toBe(14.5);
  });

  it("이월 빚이 크면 발생에서 그만큼 차감", () => {
    // grant 15, 빚 3 → total 12
    const seed = computeNewCycleSeed({
      leaveStartDate: "2024-06-01",
      currentCycle: 3,
      prevRemaining: -3,
    });
    expect(seed.total).toBe(12);
  });
});
