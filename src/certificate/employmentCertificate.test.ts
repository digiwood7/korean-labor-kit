import { describe, expect, it } from "vitest";
import {
  buildEmploymentCertificateHtml,
  type CertificateInput,
} from "./employmentCertificate";

/**
 * HTML 스냅샷이 아니라 "무엇이 반드시 들어가고, 무엇이 절대 새면 안 되는가"를 단언한다.
 * 예시 데이터는 전부 가상(홍길동 / 주식회사 예시)이며 실제 개인정보가 아니다.
 */
const base: CertificateInput = {
  employee: {
    name: "홍길동",
    residentId: "901010-1234567",
    address: "서울특별시 중구 예시로 12",
    department: "연구소",
    position: "책임연구원",
    joinDate: "2021-03-02",
    duty: "제품 설계",
  },
  company: {
    name: "주식회사 예시",
    businessNumber: "123-45-67890",
    address: "서울특별시 강남구 예시대로 100",
    phone: "02-1234-5678",
    ceoName: "김대표",
    sealImageUrl: "https://example.com/seal.png",
  },
  purpose: "금융기관 제출용",
  issueDate: "2026-07-05",
  certificateNumber: "2026-0001",
};

describe("buildEmploymentCertificateHtml", () => {
  it("완결 HTML 문서를 만든다", () => {
    const html = buildEmploymentCertificateHtml(base);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain("재직증명서");
  });

  it("필수/입력 필드가 모두 담긴다", () => {
    const html = buildEmploymentCertificateHtml(base);
    expect(html).toContain("홍길동");
    expect(html).toContain("주식회사 예시");
    expect(html).toContain("김대표");
    expect(html).toContain("금융기관 제출용");
    expect(html).toContain("책임연구원");
    expect(html).toContain("제품 설계");
    // 재직기간: 입사일이 한글 포맷으로
    expect(html).toContain("2021년 3월 2일 ~ 현재 (재직 중)");
    // 발급일 한글 포맷
    expect(html).toContain("2026년 7월 5일");
    // 발급번호 줄
    expect(html).toContain("2026-0001");
  });

  it("기본값(mask)은 주민번호 뒷자리를 가리고 원본 뒷자리는 새지 않는다", () => {
    const html = buildEmploymentCertificateHtml(base);
    expect(html).toContain("901010-1******");
    expect(html).not.toContain("901010-1234567"); // 원본 전체가 노출되면 안 됨
    expect(html).toContain("주민등록번호");
  });

  it("birth 모드는 생년월일로 바꾸고 라벨도 바뀐다", () => {
    const html = buildEmploymentCertificateHtml({ ...base, residentIdMode: "birth" });
    expect(html).toContain("생년월일");
    expect(html).toContain("1990년 10월 10일");
    expect(html).not.toContain("901010-1234567");
    expect(html).not.toContain("901010-1******");
  });

  it("full 모드일 때만 원본 주민번호가 그대로 들어간다", () => {
    const html = buildEmploymentCertificateHtml({ ...base, residentIdMode: "full" });
    expect(html).toContain("901010-1234567");
  });

  it("발급번호가 없으면 발급번호 줄이 없다", () => {
    const html = buildEmploymentCertificateHtml({ ...base, certificateNumber: undefined });
    expect(html).not.toContain("발급번호");
  });

  it("직인: includeSeal + sealImageUrl 있어야 img가 나온다", () => {
    const withSeal = buildEmploymentCertificateHtml(base);
    expect(withSeal).toContain('class="seal"');
    expect(withSeal).toContain("https://example.com/seal.png");

    const noSeal = buildEmploymentCertificateHtml({ ...base, includeSeal: false });
    expect(noSeal).not.toContain('class="seal"');

    const noUrl = buildEmploymentCertificateHtml({
      ...base,
      company: { ...base.company, sealImageUrl: null },
    });
    expect(noUrl).not.toContain('class="seal"');
  });

  it("duty가 없으면 담당업무 행이 없다", () => {
    const html = buildEmploymentCertificateHtml({
      ...base,
      employee: { ...base.employee, duty: undefined },
    });
    expect(html).not.toContain("담당업무");
  });

  it("HTML 특수문자는 이스케이프된다", () => {
    const html = buildEmploymentCertificateHtml({
      ...base,
      employee: { ...base.employee, name: "<b>홍&길동</b>" },
    });
    expect(html).toContain("&lt;b&gt;홍&amp;길동&lt;/b&gt;");
    expect(html).not.toContain("<b>홍&길동</b>");
  });

  it("issueDate를 생략하면 오늘(KST) 날짜가 채워진다", () => {
    const html = buildEmploymentCertificateHtml({ ...base, issueDate: undefined });
    const kst = new Date(Date.now() + 9 * 3600 * 1000);
    const expected = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
    expect(html).toContain(expected);
  });
});
