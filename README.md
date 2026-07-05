# korean-labor-kit

**한국 근로기준법 수당·연차 계산을 코드와 테스트로.** 연장·야간·휴일 근로수당(제56조 배율),
연차(발생·가산·이월), 공휴일(한국천문연구원 KASI API), 급여월/정산기간, 재직증명서 HTML까지
프레임워크에 묶이지 않는 순수 함수로 제공한다.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#기여-환영)
[![Tests](https://img.shields.io/badge/tests-90%20passing-brightgreen.svg)](#타임존-안전성)
[![Node](https://img.shields.io/badge/node-%3E%3D22-blue.svg)](package.json)
[![Types](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)

## 왜 만들었나

근로기준법 제56조의 연장·야간·휴일 가산 배율, 연차 발생·가산·이월 산식은 규정은 공개돼 있지만
"코드로 어떻게 계산하는가"는 각 회사 급여 시스템 안에 흩어져 있고 밖에서 검증하기 어렵다. 이
저장소는 그 계산을 **누구나 읽고 테스트로 확인할 수 있는 순수 함수**로 꺼내 놓았다. DB도,
프레임워크도, 회사 데이터도 없이 값만 넣으면 값이 나온다. 틀린 부분이 있으면 이슈와 PR로
고칠 수 있다.

> 이 킷은 실제 운영 중인 HR 시스템에서 검증된 계산 로직을 회사 결합 코드만 걷어내 공개한 것이다.

## 60초 빠른 시작

```bash
git clone https://github.com/digiwood7/korean-labor-kit
cd korean-labor-kit
npm install
npm test          # 90개 테스트 통과
```

```ts
import { calcRegularOvertimePay } from "korean-labor-kit/overtime";

// 평일 연장근로 18:00~20:00, 시간당 통상임금 10,000원
const pay = calcRegularOvertimePay({
  date: "2026-06-15",
  startTime: "18:00",
  endTime: "20:00",
  ordinaryWage: 10000,
});
console.log(pay.weightedHours, pay.amount); // 3, 30000  (2h × 1.5배)
```

바로 돌려보고 싶으면 `examples/`를 실행한다.

```bash
npx tsx examples/overtime.ts      # 수당 계산 여러 상황
npx tsx examples/leave.ts         # 연차 발생·이월
npx tsx examples/certificate.ts   # 재직증명서 HTML 생성 → 파일 저장
npx tsx examples/next-api-route.ts# Next.js Route Handler 연동
```

## 모듈 한눈에

| 모듈 | 무엇을 하나 | 주요 export | 외부 패키지 |
|---|---|---|---|
| [`overtime`](src/overtime/README.md) | 연장·야간·휴일 근로수당(제56조 배율), 주말출장, 취업규칙 옵션 | `calcLaborPay`, `calcRegularOvertimePay`, `calcWeekendTripPay`, `getDayType` | 없음 |
| [`leave`](src/leave/README.md) | 연차 발생·가산·주기 이월 차감, 보건휴가 공제 | `calculateTotalLeaveByCycle`, `computeNewCycleSeed`, `getLeaveCycleYear`, `healthLeaveDeduction` | 없음 |
| [`holidays`](src/holidays/README.md) | 한국 공휴일 조회(KASI API + 캐시 + 대체공휴일 + 폴백 표) | `HolidayClient`, `isWeekend` | 없음(`fetch`) |
| [`payroll`](src/payroll/README.md) | 월급날·연장근로 마감일·집계기간 계산 | `getPayday`, `getOvertimePeriod`, `getPayrollMonth` | 없음 |
| [`certificate`](src/certificate/README.md) | 재직증명서 A4 HTML 빌더, 주민번호 마스킹, 발급번호 채번 | `buildEmploymentCertificateHtml`, `maskResidentId`, `nextCertificateNumber` | 없음 |

각 모듈 폴더에 자체 README가 있고, 필요한 `src/<모듈>/` 폴더만 복사해도 독립적으로 동작한다.

## 배율 매트릭스 (근로기준법 제56조)

통상임금 대비 지급 배율이다. 야간(22시~06시)·휴일·연장 가산이 중첩되면 합산된다.

|                       | 평일(소정근로일) | 토요일(무급휴무일) | 일요일·공휴일 |
|-----------------------|:---:|:---:|:---:|
| 8h 이내 · 주간(06~22) | 1.0 | 1.5 | 1.5 |
| 8h 초과 · 주간(06~22) | 1.5 | 1.5 | 2.0 |
| 8h 이내 · 야간(22~06) | 1.5 | 2.0 | 2.0 |
| 8h 초과 · 야간(22~06) | 2.0 | 2.0 | 2.5 |

- 평일 연장근로는 소정 8시간을 이미 채운 "초과" 근로이므로 `priorHours=8`로 계산한다.
- 토·일·공휴일 근로와 주말출장은 그날 처음부터 근로하므로 `priorHours=0`.
- 계산은 **분(minute) 단위**로 이뤄져 시각마다 야간/8h초과 여부를 정확히 반영한다.

## 취업규칙에 따라 결과가 달라진다

배율표는 법정 기본값이지만, **토요일을 유급휴일로 두는 회사**는 토요일 근로에도 일요일·공휴일
열을 적용해야 한다. 이 킷은 그 차이를 옵션 하나로 처리한다. 옵션을 주지 않으면 법정 기본값
(토요일=무급휴무일)으로 계산되어 결과가 원본과 100% 동일하다.

```ts
import { calcRegularOvertimePay } from "korean-labor-kit/overtime";

// 토요일 09:00~19:00 근무(휴게 12~13시), 시간당 통상임금 10,000원 → 실근무 9시간
const args = {
  date: "2026-06-13", // 토요일
  startTime: "09:00", endTime: "19:00", ordinaryWage: 10000,
  breakStart: "12:00", breakEnd: "13:00",
} as const;

calcRegularOvertimePay({ ...args });
// 토요일=무급휴무일(기본): 9h × 1.5 = 13.5h → 135,000원

calcRegularOvertimePay({ ...args, workRule: { saturdayType: "paid_holiday" } });
// 토요일=유급휴일(옵션): 8×1.5 + 1×2.0 = 14h → 140,000원
```

같은 근무 기록이라도 취업규칙이 다르면 수당이 달라진다. 야간 시간대도
`workRule.nightRange`로 조정할 수 있다. 자세한 내용은 [overtime README](src/overtime/README.md)에 있다.

## 타임존 안전성

날짜 계산은 **실행 환경의 시간대에 의존하지 않는다.** 날짜 문자열을 로컬 자정으로 파싱하거나
UTC 캘린더 필드만 쓰도록 정리해, 서버가 어느 시간대에 있든 같은 달력 날짜를 가리킨다. 전체
테스트를 4개 대표 시간대에서 돌려 결과가 동일함을 확인했다.

```
TZ=UTC               → 90 passed
TZ=Asia/Seoul        → 90 passed   (KST, +9)
TZ=America/New_York  → 90 passed   (음수 오프셋, -5/-4)
TZ=Pacific/Kiritimati→ 90 passed   (극단 양수 오프셋, +14)
```

> 반환되는 `Date`를 문자열로 포맷할 때는 모듈별 안내를 따른다(예: `leave`는 로컬 게터,
> `payroll`은 `toISOString()`). 각 모듈 README의 "날짜/시간대 주의"에 정리돼 있다.

## ⚠️ 법적 면책

> **이 라이브러리는 계산을 돕는 참고용 구현이며, 법적 효력이나 노무 자문을 대체하지 않는다.**
>
> - 실제 임금·연차·수당은 개별 사업장의 **취업규칙·단체협약·근로계약**과 최신 법 개정에 따라
>   달라질 수 있다.
> - 이 킷의 기본값은 근로기준법 제56조의 일반적 해석을 따르지만, 모든 사업장·모든 사안을
>   포괄하지 않는다.
> - 실무에 적용하기 전에 **공인노무사 등 전문가의 검토**를 받을 것을 강력히 권장한다.
> - 이 코드를 사용해 발생한 결과에 대해 저자는 어떠한 책임도 지지 않는다(MIT 라이선스 참조).

## 설치·사용 방법

빌드 산출물(dist) 없이 **TypeScript 소스를 그대로 쓰는 것**이 기본 전제다. 두 가지 방법이 있다.

**1) 필요한 모듈 폴더만 복사 (권장)**

```bash
cp -r korean-labor-kit/src/overtime your-project/lib/labor-overtime
```

각 모듈은 자기완결이라 필요한 것만 골라 복사해도 안전하다. import 경로만 맞추면 끝이다.

**2) git 의존성으로 통째 설치**

```bash
npm install github:digiwood7/korean-labor-kit
```

```ts
import { calcLaborPay } from "korean-labor-kit/overtime";
import { buildEmploymentCertificateHtml } from "korean-labor-kit/certificate";
```

번들러가 TS 소스를 직접 처리하는 환경(Next.js/Vite 등)에서 동작한다. 상대 import가 ESM 규칙상
`.js`로 적혀 있으나 실제 파일은 `.ts`이며, `moduleResolution`이 `bundler`/`node16`/`nodenext`이면
그대로 해석된다.

**Next.js에서 쓸 때**는 이 패키지가 빌드된 JS가 아니라 TS 소스를 배포하므로 `transpilePackages`에
추가한다.

```js
// next.config.js
module.exports = {
  transpilePackages: ["korean-labor-kit"],
};
```

Route Handler 연동 예시는 [`examples/next-api-route.ts`](examples/next-api-route.ts)에 있다.

## 시크릿/환경변수

이 킷은 어떤 실제 API 키도 갖고 있지 않다. 외부 네트워크가 필요한 것은 공휴일 조회 하나뿐이며,
`HolidayClient`의 `apiKey` 옵션으로 주입하거나 없으면 `HOLIDAY_API_KEY` 환경변수를 폴백으로
읽고, 그마저 없으면 내장 폴백 표를 쓴다. 발급 방법은 [`.env.example`](.env.example)과
[holidays README](src/holidays/README.md)를 참고한다.

## 기여 환영

- 계산이 틀렸거나 최신 법 개정을 반영하지 못한 부분을 발견하면 **이슈**로 알려주면 좋겠다.
  가능하면 근거(조문·행정해석·판례)를 함께 남겨주면 검토가 빨라진다.
- PR은 언제든 환영한다. 코드를 바꿀 땐 **동작을 고정하는 테스트를 함께** 올려달라
  (`npm test`, `npm run typecheck` 통과). 예제가 필요하면 `examples/`에 추가한다.
- 새 계산을 추가할 때도 "값 입력 → 값 출력"의 순수 함수 원칙과 프레임워크 비종속을 지킨다.

## 라이선스

[MIT](LICENSE) © 2026 digiwood7
