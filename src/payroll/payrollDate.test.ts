import { describe, expect, it } from "vitest";
import {
  getOvertimeClosingDate,
  getOvertimePeriod,
  getPayday,
  getPayrollMonth,
} from "./payrollDate.js";

/**
 * 원본의 lib/utils/payrollDate.test.ts에 있던 케이스를 vitest 단언으로 이식했다.
 * 원본은 console.log 기반 수동 확인용 스크립트였고, 여기서는 실제 assert로 검증한다.
 * (원본 5개 케이스가 전부 주말 케이스라 "주말만 휴무" 기본 동작으로도 동일한 결과가 나온다.)
 */

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

describe("getPayday / getOvertimeClosingDate (기존 payrollDate.test.ts 이식)", () => {
  it("25일이 평일이면 그대로 월급날 (2026년 2월)", async () => {
    expect(toDateString(await getPayday(2026, 2))).toBe("2026-02-25");
    expect(toDateString(await getOvertimeClosingDate(2026, 2))).toBe("2026-02-24");
  });

  it("25일이 일요일, 24일이 토요일이면 금요일(23일)로 이동 (2026년 1월)", async () => {
    expect(toDateString(await getPayday(2026, 1))).toBe("2026-01-23");
    expect(toDateString(await getOvertimeClosingDate(2026, 1))).toBe("2026-01-22");
  });

  it("2026년 3월 (25일이 평일)", async () => {
    expect(toDateString(await getPayday(2026, 3))).toBe("2026-03-25");
    expect(toDateString(await getOvertimeClosingDate(2026, 3))).toBe("2026-03-24");
  });

  it("2026년 10월 (25일이 일요일 → 23일 금요일)", async () => {
    expect(toDateString(await getPayday(2026, 10))).toBe("2026-10-23");
    expect(toDateString(await getOvertimeClosingDate(2026, 10))).toBe("2026-10-22");
  });

  it("2026년 7월 (25일이 토요일 → 24일 금요일)", async () => {
    expect(toDateString(await getPayday(2026, 7))).toBe("2026-07-24");
    expect(toDateString(await getOvertimeClosingDate(2026, 7))).toBe("2026-07-23");
  });
});

describe("isHoliday 콜백 주입", () => {
  it("콜백을 주면 평일이라도 휴무로 처리해 이전 평일로 이동한다", async () => {
    // 2026-07-24(금)를 임시공휴일로 지정 → 7월 월급날(기본 24일 금요일)이 23일(목)로 당겨져야 한다
    const isHoliday = (date: Date) => toDateString(date) === "2026-07-24";
    expect(toDateString(await getPayday(2026, 7, { isHoliday }))).toBe("2026-07-23");
  });

  it("콜백을 안 주면 주말만 휴무로 취급한다(기본 동작)", async () => {
    expect(toDateString(await getPayday(2026, 7))).toBe("2026-07-24");
  });
});

describe("getOvertimePeriod", () => {
  it("집계기간은 전달 마감일 다음날 ~ 이번달 마감일이다 (2026년 7월)", async () => {
    const period = await getOvertimePeriod(2026, 7);
    // 2026년 6월: 25일=목요일(평일) → payday=06-25, closing=06-24
    expect(period.startDate).toBe("2026-06-25");
    expect(period.endDate).toBe("2026-07-23");
    expect(period.payday).toBe("2026-07-24");
  });
});

describe("getPayrollMonth", () => {
  it("집계기간 내부의 날짜는 해당 연월을 반환한다", async () => {
    expect(await getPayrollMonth("2026-07-01")).toEqual({ year: 2026, month: 7 });
    expect(await getPayrollMonth("2026-06-25")).toEqual({ year: 2026, month: 7 }); // 기간 시작일
    expect(await getPayrollMonth("2026-07-23")).toEqual({ year: 2026, month: 7 }); // 기간 종료일(마감일)
  });

  it("마감일 다음날은 다음달 집계로 넘어간다 (경계값)", async () => {
    expect(await getPayrollMonth("2026-07-24")).toEqual({ year: 2026, month: 8 });
  });

  it("연도 경계도 올바르게 처리한다 (12월→다음해 1월 집계)", async () => {
    // 2026년 12월 25일 = 금요일(평일) → payday=12-25, closing=12-24
    const decPeriod = await getOvertimePeriod(2026, 12);
    expect(decPeriod.endDate).toBe("2026-12-24");
    expect(await getPayrollMonth("2026-12-24")).toEqual({ year: 2026, month: 12 });
    expect(await getPayrollMonth("2026-12-25")).toEqual({ year: 2027, month: 1 });
  });
});
