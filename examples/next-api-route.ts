/**
 * 예제: Next.js API Route(App Router) 연동 스니펫
 *
 * 실행: npx tsx examples/next-api-route.ts
 *
 * Next.js의 Route Handler는 웹 표준 Request/Response 위에서 동작한다. 그래서 이 예제는
 * next 패키지 없이도 그대로 실행되며, 아래 handler 함수 본문을 그대로
 * `app/api/certificate/route.ts` 의 `POST` 로 옮기면 실제 라우트가 된다.
 */
import { buildEmploymentCertificateHtml } from "../src/certificate/index.js";
import { calcRegularOvertimePay } from "../src/overtime/index.js";

/**
 * 실제 Next.js에서는 이렇게 쓴다:
 *
 *   // app/api/certificate/route.ts
 *   import { buildEmploymentCertificateHtml } from "korean-labor-kit/certificate";
 *
 *   export async function POST(req: Request): Promise<Response> {
 *     const body = await req.json();
 *     const html = buildEmploymentCertificateHtml(body);   // body 검증은 zod 등으로
 *     return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
 *   }
 *
 * 아래는 위 handler 를 next 없이 실행해 보기 위한 동일 코드다.
 */
async function certificatePOST(req: Request): Promise<Response> {
  const body = (await req.json()) as Parameters<typeof buildEmploymentCertificateHtml>[0];
  const html = buildEmploymentCertificateHtml(body);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** 수당 계산 API 예시(JSON 응답) */
async function overtimePOST(req: Request): Promise<Response> {
  const body = (await req.json()) as Parameters<typeof calcRegularOvertimePay>[0];
  const result = calcRegularOvertimePay(body);
  return Response.json(result);
}

// --- 아래는 실행 데모(실제 라우트에는 필요 없음) ---
async function demo(): Promise<void> {
  // 1) 재직증명서 라우트에 POST 요청을 흉내낸다
  const certReq = new Request("http://localhost/api/certificate", {
    method: "POST",
    body: JSON.stringify({
      employee: { name: "홍길동", joinDate: "2021-03-02", residentId: "901010-1234567" },
      company: { name: "주식회사 예시", ceoName: "김대표" },
      purpose: "관공서 제출용",
      issueDate: "2026-07-05",
    }),
  });
  const certRes = await certificatePOST(certReq);
  const certHtml = await certRes.text();
  console.log("[POST /api/certificate]");
  console.log("  status       :", certRes.status);
  console.log("  Content-Type :", certRes.headers.get("Content-Type"));
  console.log("  HTML 길이    :", certHtml.length.toLocaleString("ko-KR"), "자");
  console.log("  주민번호     :", certHtml.includes("901010-1******") ? "901010-1****** (마스킹 OK)" : "확인 필요");

  // 2) 수당 계산 라우트
  const otReq = new Request("http://localhost/api/overtime", {
    method: "POST",
    body: JSON.stringify({
      date: "2026-06-15",
      startTime: "18:00",
      endTime: "20:00",
      ordinaryWage: 15072,
    }),
  });
  const otRes = await overtimePOST(otReq);
  const ot = (await otRes.json()) as { weightedHours: number; amount: number };
  console.log("\n[POST /api/overtime]");
  console.log("  status       :", otRes.status);
  console.log("  가중시간     :", ot.weightedHours, "h");
  console.log("  수당         :", ot.amount.toLocaleString("ko-KR"), "원");
}

await demo();
