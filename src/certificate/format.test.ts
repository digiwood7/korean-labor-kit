import { describe, expect, it } from "vitest";
import { formatDateKr, residentIdToBirthDate, maskResidentId } from "./format";

/**
 * 원본의 lib/certificate/format.test.ts(node:test)를 vitest로 이식했다.
 * 단언은 원본과 동일하며, 예시 주민번호는 실제 값이 아닌 임의 자릿수다.
 */
describe("formatDateKr", () => {
  it("ISO 날짜를 한글식으로", () => {
    expect(formatDateKr("2026-06-09")).toBe("2026년 6월 9일");
  });

  it("빈 값은 빈 문자열", () => {
    expect(formatDateKr("")).toBe("");
    expect(formatDateKr(null)).toBe("");
    expect(formatDateKr(undefined)).toBe("");
  });

  it("형식이 아니면 빈 문자열", () => {
    expect(formatDateKr("2026/06/09")).toBe("");
  });
});

describe("residentIdToBirthDate", () => {
  it("1900년대(성별코드 1)", () => {
    expect(residentIdToBirthDate("901010-1234567")).toBe("1990년 10월 10일");
  });

  it("2000년대(성별코드 3)", () => {
    expect(residentIdToBirthDate("050301-3234567")).toBe("2005년 3월 1일");
  });

  it("잘못된 입력은 빈 문자열", () => {
    expect(residentIdToBirthDate("abc")).toBe("");
    expect(residentIdToBirthDate(null)).toBe("");
  });
});

describe("maskResidentId", () => {
  it("mask: 뒷자리 마스킹", () => {
    expect(maskResidentId("901010-1234567", "mask")).toBe("901010-1******");
  });

  it("full: 원본 그대로", () => {
    expect(maskResidentId("901010-1234567", "full")).toBe("901010-1234567");
  });

  it("birth: 생년월일 문자열", () => {
    expect(maskResidentId("901010-1234567", "birth")).toBe("1990년 10월 10일");
  });

  it("빈 값은 빈 문자열", () => {
    expect(maskResidentId(null, "mask")).toBe("");
  });
});
