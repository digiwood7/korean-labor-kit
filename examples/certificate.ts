/**
 * 예제: 재직증명서 HTML 생성 → 파일 저장
 *
 * 실행: npx tsx examples/certificate.ts
 *
 * 생성된 HTML을 examples/out/employment-certificate.html 로 저장한다.
 * 브라우저로 열어 확인하거나 인쇄(→ PDF 저장)하면 된다. (out/ 폴더는 .gitignore 처리됨)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildEmploymentCertificateHtml,
  nextCertificateNumber,
} from "../src/certificate/index";

// 발급번호 채번 — 실제로는 "직전 번호"를 각자 DB에서 구해 넘긴다.
const certificateNumber = nextCertificateNumber(2026, 41); // "2026-0042"

const html = buildEmploymentCertificateHtml({
  employee: {
    name: "홍길동",
    residentId: "901010-1234567", // 기본 mask 모드 → "901010-1******"로 표기
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
    // sealImageUrl 을 넣으면 대표이사명 옆에 직인 이미지가 합성된다(URL 또는 dataURI).
  },
  purpose: "금융기관 제출용",
  issueDate: "2026-07-05",
  certificateNumber,
  // residentIdMode: "birth", // 주민번호 대신 생년월일만 표기하고 싶으면 주석 해제
});

const outDir = join(import.meta.dirname, "out");
const outPath = join(outDir, "employment-certificate.html");
await mkdir(outDir, { recursive: true });
await writeFile(outPath, html, "utf8");

console.log(`발급번호        : 제 ${certificateNumber} 호`);
console.log(`HTML 길이       : ${html.length.toLocaleString("ko-KR")}자`);
console.log(`주민번호 표기   : 901010-1****** (기본 mask 모드 — 원본 뒷자리는 새지 않음)`);
console.log(`저장 위치       : ${outPath}`);
console.log("\n브라우저로 열어 확인하거나, 인쇄 대화상자에서 'PDF로 저장'하면 A4 증명서가 된다.");
