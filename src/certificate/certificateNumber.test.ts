import { describe, expect, it } from "vitest";
import { nextCertificateNumber, parseCertificateSeq } from "./certificateNumber.js";

describe("nextCertificateNumber", () => {
  it("첫 발급(직전 0)은 0001", () => {
    expect(nextCertificateNumber(2026, 0)).toBe("2026-0001");
  });

  it("직전 41 다음은 0042", () => {
    expect(nextCertificateNumber(2026, 41)).toBe("2026-0042");
  });

  it("문자열 접두사와 옵션(자릿수·구분자)", () => {
    expect(nextCertificateNumber("HR", 7, { pad: 3, separator: "/" })).toBe("HR/008");
  });

  it("음수·NaN 직전값은 첫 번호로 방어", () => {
    expect(nextCertificateNumber(2026, -5)).toBe("2026-0001");
    expect(nextCertificateNumber(2026, Number.NaN)).toBe("2026-0001");
  });

  it("네 자리를 넘으면 잘리지 않고 그대로 커진다", () => {
    expect(nextCertificateNumber(2026, 9999)).toBe("2026-10000");
  });
});

describe("parseCertificateSeq", () => {
  it("발급번호에서 일련번호만 되읽는다", () => {
    expect(parseCertificateSeq("2026-0042")).toBe(42);
  });

  it("사용자 구분자도 지원", () => {
    expect(parseCertificateSeq("HR/008", "/")).toBe(8);
  });

  it("형식이 안 맞으면 null", () => {
    expect(parseCertificateSeq("2026")).toBeNull();
    expect(parseCertificateSeq("2026-abc")).toBeNull();
    expect(parseCertificateSeq(null)).toBeNull();
  });

  it("되읽은 값을 다시 채번에 넘기면 다음 번호가 나온다", () => {
    const last = parseCertificateSeq("2026-0042");
    expect(nextCertificateNumber(2026, last ?? 0)).toBe("2026-0043");
  });
});
