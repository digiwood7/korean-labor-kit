/**
 * 재직증명서 HTML 빌더 (프레임워크 무관)
 *
 * 원본의 `lib/certificate/employmentCertificate.ts`를 이식하되, React("use client")·
 * `document`·브라우저 인쇄 코드는 전부 걷어냈다. 이 함수는 값을 받아 **A4 인쇄용 완결 HTML
 * 문자열**만 돌려준다. 외부 CSS/폰트/스크립트 의존이 0이라 어디서든(서버·브라우저·PDF 변환기)
 * 그대로 쓸 수 있다. 레이아웃·주민번호 마스킹 규칙은 원본을 보존했다.
 */
import { formatDateKr, maskResidentId, type MaskMode } from "./format";

/** 재직증명서에 필요한 직원 정보(이 킷 자체 입력 타입 — 외부 타입에 종속되지 않는다) */
export interface CertificateEmployee {
  /** 성명 (필수) */
  name: string;
  /** 주민등록번호 "YYMMDD-XXXXXXX". residentIdMode에 따라 마스킹/생년월일 변환된다. */
  residentId?: string | null;
  /** 주소 */
  address?: string | null;
  /** 소속 / 부서 */
  department?: string | null;
  /** 직위 */
  position?: string | null;
  /** 입사일 "YYYY-MM-DD" (재직기간 시작) */
  joinDate: string;
  /** 담당업무(선택). 있으면 행을 추가한다. */
  duty?: string | null;
}

/** 발급 회사(사용자) 정보 */
export interface CertificateCompany {
  /** 회사명 (필수) */
  name: string;
  /** 사업자등록번호 */
  businessNumber?: string | null;
  /** 회사 주소 */
  address?: string | null;
  /** 대표 전화 */
  phone?: string | null;
  /** 대표이사 성명 (필수) */
  ceoName: string;
  /** 직인 이미지 URL 또는 dataURI(선택). includeSeal이 true일 때만 합성한다. */
  sealImageUrl?: string | null;
}

/** buildEmploymentCertificateHtml 입력 */
export interface CertificateInput {
  employee: CertificateEmployee;
  company: CertificateCompany;
  /** 용도 (예: 금융기관 제출용) */
  purpose: string;
  /** 발급일 "YYYY-MM-DD". 생략하면 오늘(KST) 날짜를 쓴다. */
  issueDate?: string;
  /** 발급번호(예: "2026-0001"). 생략하면 발급번호 줄을 표시하지 않는다. */
  certificateNumber?: string;
  /** 주민번호 표기 방식. 기본 "mask"(뒷자리 별표). @see MaskMode */
  residentIdMode?: MaskMode;
  /** 직인 합성 여부. 기본 true(단, company.sealImageUrl이 있을 때만 실제로 그려진다). */
  includeSeal?: boolean;
}

/** HTML 특수문자 이스케이프 (텍스트 값 주입 시 XSS/깨짐 방지) */
function esc(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** KST(UTC+9) 기준 오늘 날짜를 "YYYY-MM-DD"로 반환 */
function todayInKst(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 재직증명서 HTML 문자열을 만든다.
 *
 * @returns `<!DOCTYPE html>`로 시작하는 완결 HTML(인라인 CSS 포함, 외부 의존 0)
 */
export function buildEmploymentCertificateHtml(input: CertificateInput): string {
  const { employee, company, purpose } = input;
  const issueDate = input.issueDate ?? todayInKst();
  const residentMode: MaskMode = input.residentIdMode ?? "mask";
  const includeSeal = input.includeSeal ?? true;

  const residentLabel = residentMode === "birth" ? "생년월일" : "주민등록번호";
  const residentValue = maskResidentId(employee.residentId, residentMode);
  const period = `${formatDateKr(employee.joinDate)} ~ 현재 (재직 중)`;

  const sealImg =
    includeSeal && company.sealImageUrl
      ? `<img src="${esc(company.sealImageUrl)}" alt="직인" class="seal" />`
      : "";

  const docNoRow = input.certificateNumber
    ? `<div class="doc-no">발급번호 : 제 ${esc(input.certificateNumber)} 호</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>재직증명서 - ${esc(employee.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
      background-color: #f0f0f0;
      display: flex; justify-content: center;
      padding: 20px; color: #000;
    }
    .a4-page {
      width: 210mm; min-height: 297mm; background:#fff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 25mm 22mm; position: relative;
    }
    .doc-no { text-align: right; font-size: 13px; color:#333; margin-bottom: 10px; }
    h1 { text-align:center; font-size: 34px; font-weight:bold; letter-spacing: 12px; margin: 20px 0 6px; }
    .subtitle { text-align:center; font-size: 15px; color:#555; letter-spacing: 6px; margin-bottom: 30px; }
    table { width:100%; border-collapse: collapse; font-size: 15px; table-layout: fixed; }
    th, td { border: 1px solid #333; padding: 12px 10px; vertical-align: middle; }
    th { background:#f5f5f5; font-weight: normal; width: 28%; text-align:center; }
    td { text-align:left; padding-left: 14px; }
    .statement { text-align:center; font-size: 17px; margin: 40px 0 30px; letter-spacing: 1px; }
    .issue-date { text-align:center; font-size: 16px; margin-bottom: 40px; }
    .issuer { text-align: right; font-size: 15px; line-height: 2; }
    .issuer .company-name { font-size: 18px; font-weight: bold; }
    .ceo-line { position: relative; display: inline-block; margin-top: 6px; font-size: 17px; }
    .seal {
      position: absolute; right: -14px; top: 50%;
      transform: translateY(-50%);
      width: 55px; height: 55px; object-fit: contain;
      opacity: 0.92; pointer-events: none;
    }
    @media print {
      body { background:#fff; padding: 0; }
      .a4-page { box-shadow:none; width:100%; min-height:auto; padding: 20mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { size: A4 portrait; margin: 0; }
  </style>
</head>
<body>
  <div class="a4-page">
    ${docNoRow}
    <h1>재직증명서</h1>
    <div class="subtitle">在 職 證 明 書</div>

    <table>
      <tbody>
        <tr><th>성 명</th><td>${esc(employee.name)}</td></tr>
        <tr><th>${residentLabel}</th><td>${esc(residentValue)}</td></tr>
        <tr><th>주 소</th><td>${esc(employee.address)}</td></tr>
        <tr><th>소속 / 부서</th><td>${esc(employee.department)}</td></tr>
        <tr><th>직 위</th><td>${esc(employee.position)}</td></tr>
        <tr><th>재 직 기 간</th><td>${period}</td></tr>
        ${employee.duty ? `<tr><th>담당업무</th><td>${esc(employee.duty)}</td></tr>` : ""}
        <tr><th>용 도</th><td>${esc(purpose)}</td></tr>
      </tbody>
    </table>

    <p class="statement">위와 같이 재직하고 있음을 증명합니다.</p>
    <p class="issue-date">${formatDateKr(issueDate)}</p>

    <div class="issuer">
      <div class="company-name">${esc(company.name)}</div>
      ${company.businessNumber ? `<div>사업자등록번호 : ${esc(company.businessNumber)}</div>` : ""}
      ${company.address ? `<div>${esc(company.address)}</div>` : ""}
      ${company.phone ? `<div>TEL : ${esc(company.phone)}</div>` : ""}
      <div class="ceo-line">대표이사 &nbsp;${esc(company.ceoName)}${sealImg}</div>
    </div>
  </div>
</body>
</html>`;
}
