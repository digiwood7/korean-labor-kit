# src/certificate — 재직증명서 HTML 생성

직원 정보와 회사 정보를 받아 **A4 인쇄용 재직증명서 HTML 문자열**을 만든다. 원본의
`lib/certificate/`에서 계산·문자열 로직만 뽑아왔고, React("use client")·`document`·브라우저
인쇄 코드는 전부 걷어냈다. 반환값은 외부 CSS/폰트/스크립트 의존이 0인 완결 HTML이라
서버·브라우저·PDF 변환기 어디서든 그대로 쓸 수 있다.

## 구성 파일

- `format.ts` — 날짜 포맷(`formatDateKr`), 주민등록번호 표기 변환(`maskResidentId`, `residentIdToBirthDate`).
- `certificateNumber.ts` — 발급번호 채번 순수 함수(`nextCertificateNumber`, `parseCertificateSeq`).
- `employmentCertificate.ts` — HTML 빌더(`buildEmploymentCertificateHtml`)와 입력 타입.

## 빠른 사용법

```ts
import {
  buildEmploymentCertificateHtml,
  nextCertificateNumber,
} from "korean-labor-kit/certificate";

// 발급번호 채번 (직전 번호는 각자 DB에서 구해 넘긴다)
const certificateNumber = nextCertificateNumber(2026, 41); // "2026-0042"

const html = buildEmploymentCertificateHtml({
  employee: {
    name: "홍길동",
    residentId: "901010-1234567", // 기본 mask 모드면 "901010-1******"로 표기
    address: "서울특별시 중구 예시로 12",
    department: "연구소",
    position: "책임연구원",
    joinDate: "2021-03-02",
    duty: "제품 설계", // 선택
  },
  company: {
    name: "주식회사 예시",
    businessNumber: "123-45-67890",
    address: "서울특별시 강남구 예시대로 100",
    phone: "02-1234-5678",
    ceoName: "김대표",
    sealImageUrl: "https://cdn.example.com/seal.png", // 선택(URL 또는 dataURI)
  },
  purpose: "금융기관 제출용",
  issueDate: "2026-07-05", // 생략하면 오늘(KST)
  certificateNumber, // 생략하면 발급번호 줄을 표시하지 않음
});

// html 을 파일로 저장하거나 브라우저에서 인쇄하면 된다.
```

## 주민등록번호 표기 방식 (`residentIdMode`)

| 값 | 표기 | 라벨 | 용도 |
|---|---|---|---|
| `"mask"` (기본) | `901010-1******` | 주민등록번호 | 뒷자리를 가림(권장) |
| `"birth"` | `1990년 10월 10일` | 생년월일 | 주민번호 대신 생년월일만 노출 |
| `"full"` | `901010-1234567` | 주민등록번호 | 원본 그대로(내부용 등 필요할 때만) |

`residentId`를 아예 넘기지 않으면 해당 칸은 빈 값으로 나온다. 모든 텍스트 값은 HTML
이스케이프되어 주입되므로 이름 등에 `<`, `&`가 들어가도 깨지지 않는다.

## 발급번호 채번

이 킷은 저장소를 모르므로 "직전 번호가 무엇인지"는 각자 자기 DB에서 구해 넘긴다.

```ts
import { nextCertificateNumber, parseCertificateSeq } from "korean-labor-kit/certificate";

// 내 DB에서 올해 마지막 발급번호를 읽어온 뒤
const lastNumber = "2026-0041"; // 예: SELECT ... ORDER BY seq DESC LIMIT 1
const lastSeq = parseCertificateSeq(lastNumber) ?? 0; // 41
const next = nextCertificateNumber(2026, lastSeq);     // "2026-0042"

// 자릿수·구분자 커스터마이즈
nextCertificateNumber("HR", 7, { pad: 3, separator: "/" }); // "HR/008"
```

동시 발급으로 같은 번호가 충돌할 수 있는 환경(여러 요청 동시 처리)에서는 DB 쪽에서
`UNIQUE(연도, seq)` 제약을 걸고 충돌 시 재시도하는 식으로 원자성을 보장하는 것을 권장한다.
채번 "규칙"은 순수 함수로 제공하지만, "동시성 제어"는 저장소의 몫이다.

## 테스트

- `format.test.ts` — 날짜 포맷·주민번호 마스킹/생년월일 변환(원본 테스트 이식).
- `certificateNumber.test.ts` — 채번/되읽기, 음수·NaN 방어, 자릿수 초과.
- `employmentCertificate.test.ts` — 필수 필드 포함·마스킹 유출 방지·직인/발급번호 조건부 표시·
  HTML 이스케이프·KST 기본 발급일. 예시 데이터는 전부 가상이다.
