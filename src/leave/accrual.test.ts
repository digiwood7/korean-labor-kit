import { describe, expect, it } from "vitest";
import {
  calculateFirstYearLeave,
  calculateRegularLeave,
  calculateTotalLeaveByCycle,
} from "./accrual.js";
import { parseDate } from "./utils.js";

/**
 * 연차 발생 산식 테스트 (신규 추가).
 * 원본에는 accrual 전용 테스트가 없었으나, 순수 추출 후 발생일수·가산연차·최대한도
 * 산식이 그대로 동작함을 명시적으로 고정한다. 모든 케이스는 targetDate를 명시해
 * "오늘 날짜"에 의존하지 않는다.
 */
describe("calculateFirstYearLeave (1년 미만: 월 1개, 최대 11)", () => {
  it("근무 1개월차(캘린더 월수 1)면 1개", () => {
    expect(calculateFirstYearLeave("2025-06-01", new Date("2025-07-10"))).toBe(1);
  });

  it("기준일 당월(월수 0)이면 0개", () => {
    expect(calculateFirstYearLeave("2025-06-01", new Date("2025-06-20"))).toBe(0);
  });

  it("1차년도 종료 무렵(11개월)이면 11개", () => {
    expect(calculateFirstYearLeave("2025-06-01", new Date("2025-06-01T00:00:00"))).toBe(0);
    expect(calculateFirstYearLeave("2025-06-01", new Date("2026-05-31"))).toBe(11);
  });

  it("최대 11개를 넘지 않는다", () => {
    expect(calculateFirstYearLeave("2025-06-01", new Date("2027-01-01"))).toBe(11);
  });
});

describe("calculateRegularLeave (1년 이상: 기본 15 + 3년차부터 가산)", () => {
  it("1년 미만이면 0", () => {
    expect(calculateRegularLeave("2025-06-01", new Date("2026-01-01"))).toBe(0);
  });

  it("근속 1~2년은 기본 15개", () => {
    // 월 경계(매년 6월 1일)에 정확히 걸치는 케이스라 "T00:00:00"(로컬 자정)으로 명시한다.
    // 순수 "YYYY-MM-DD"는 UTC 자정으로 파싱되어 음수 오프셋 타임존에서 하루 밀릴 수 있다.
    expect(calculateRegularLeave("2024-06-01", new Date("2025-06-01T00:00:00"))).toBe(15); // 1년
    expect(calculateRegularLeave("2024-06-01", new Date("2026-06-01T00:00:00"))).toBe(15); // 2년
  });

  it("근속 3년차부터 가산 시작 (3년→16, 5년→17)", () => {
    expect(calculateRegularLeave("2024-06-01", new Date("2027-06-01T00:00:00"))).toBe(16); // 3년
    expect(calculateRegularLeave("2024-06-01", new Date("2029-06-01T00:00:00"))).toBe(17); // 5년
  });

  it("최대 25개를 넘지 않는다", () => {
    expect(calculateRegularLeave("1990-01-01", new Date("2050-01-01"))).toBe(25);
  });
});

describe("calculateTotalLeaveByCycle (주기별 발생량)", () => {
  it("1차년도는 월수 기반(최대 11)", () => {
    expect(calculateTotalLeaveByCycle("2025-06-01", 1)).toBe(11);
  });

  it("2차년도는 기본 15", () => {
    expect(calculateTotalLeaveByCycle("2025-06-01", 2)).toBe(15);
  });

  it("5차년도는 가산 반영 16", () => {
    expect(calculateTotalLeaveByCycle("2022-01-01", 5)).toBe(16);
  });
});

/**
 * 타임존 불변 회귀 방지 테스트.
 *
 * vitest 안에서는 실행 중 TZ를 바꿀 수 없으므로, "문자열 leaveStartDate 파싱 결과가
 * 로컬 Date(y, m-1, d)와 정확히 같은 값(같은 getTime())인지"를 직접 단언한다.
 * 수정 전 parseDate는 `new Date(dateString)`(UTC 자정)을 썼는데, 이는 UTC가 아닌
 * *어떤* 타임존에서 실행하든 `new Date(y, m-1, d)`(로컬 자정)와 어긋난다
 * (KST에서도 9시간 차이가 나 getTime()이 다르다) — 즉 이 등식은 실행 타임존과 무관하게
 * 항상 성립해야 하며, 수정 전 코드에서는 항상 실패했다.
 */
describe("타임존 불변 회귀 방지 (parseDate 로컬 자정 앵커링)", () => {
  it("parseDate(\"YYYY-MM-DD\")는 new Date(y, m-1, d)와 정확히 같은 시각이다", () => {
    expect(parseDate("2025-06-01").getTime()).toBe(new Date(2025, 5, 1).getTime());
    expect(parseDate("1990-01-01").getTime()).toBe(new Date(1990, 0, 1).getTime());
    expect(parseDate("2026-12-31").getTime()).toBe(new Date(2026, 11, 31).getTime());
  });

  it("calculateFirstYearLeave: 문자열 기준일과 로컬 Date 대상일 조합이 실행 타임존과 무관하게 같은 결과를 낸다", () => {
    // targetDate를 UTC 자정 문자열(new Date("2025-07-10")) 대신 로컬 자정으로 직접
    // 구성해, leaveStartDate(문자열, parseDate 경유)와 같은 기준(로컬 자정)으로 비교한다.
    expect(calculateFirstYearLeave("2025-06-01", new Date(2025, 6, 10))).toBe(1); // 2025-07-10
    expect(calculateFirstYearLeave("2025-06-01", new Date(2025, 5, 20))).toBe(0); // 2025-06-20
  });
});
