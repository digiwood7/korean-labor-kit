# src/payroll — 급여월(월급날·정산기간) 계산

"매월 25일 월급, 25일이 휴무면 이전 평일로" 규칙에 따라 월급날·연장근로 마감일·집계기간을
계산한다. 원본의 `lib/utils/payrollDate.ts`를 이식했다.

> 이 모듈의 날짜 계산과 이름은 [`korean-labor-kit/time`이 아니라] 자체적으로 완결되어 있다.
> 다른 모듈에 의존하지 않으므로 이 폴더만 복사해도 동작한다.

## 규칙

- **월급날**: 기본 매월 25일. 25일이 휴무(주말/공휴일)면 그 이전의 가장 가까운 평일로 이동.
- **연장근로 마감일**: 월급날 − 1일.
- **집계기간**: 이전달 마감일 + 1일 ~ 이번달 마감일.

## 구성 파일

- `payrollDate.ts` — `getPayday`, `getOvertimeClosingDate`, `getOvertimePeriod`, `getPayrollMonth`.

## 빠른 사용법

```ts
import { getPayday, getOvertimePeriod, getPayrollMonth } from "korean-labor-kit/payroll";

await getPayday(2026, 7);         // 2026-07-24 (25일이 토요일 → 금요일)
await getOvertimePeriod(2026, 7); // { startDate: "2026-06-25", endDate: "2026-07-23", payday: "2026-07-24" }
await getPayrollMonth("2026-07-10"); // { year: 2026, month: 7 }
```

반환되는 `Date`는 **UTC 자정** 기준이라 `toISOString().split("T")[0]`으로 안전하게 "YYYY-MM-DD"를
얻을 수 있다(실행 환경 시간대와 무관).

## 공휴일 반영 (`isHoliday` 콜백 주입)

원본은 내부에서 공휴일 API를 직접 호출했지만, 이 모듈은 자기완결이어야 하므로 공휴일
판정을 **콜백으로 주입**받는다. 콜백을 안 주면 "주말만 휴무"로 계산한다(원본 테스트 케이스는
모두 주말 케이스라 기본 동작으로도 동일한 결과가 나온다).

이 킷의 [`src/holidays`](../holidays/README.md)를 콜백으로 연결하면 공휴일까지 반영된다:

```ts
import { HolidayClient } from "korean-labor-kit/holidays";
import { getPayday } from "korean-labor-kit/payroll";

const holidays = new HolidayClient({ apiKey: process.env.HOLIDAY_API_KEY });
await getPayday(2026, 3, { isHoliday: (d) => holidays.isHoliday(d) });
// 25일 이전 며칠이 공휴일이어도 정확히 평일로 당겨진다
```

## 원본과 달라진 점

- **공휴일 의존 분리**: 직접 호출 대신 `PayrollDateOptions.isHoliday` 콜백 주입.
- **시간대 안전화**: 로컬 게터(`getDate` 등) 대신 UTC 캘린더 필드(`Date.UTC`, `getUTCDate` 등)만
  사용해, 실행 환경이 UTC든 KST든 항상 같은 결과가 나오게 했다.
- **KST 표시 함수 제외**: 원본의 `getCurrentKSTDate`/`getCurrentKSTTime`(현재 시각 표시)은 급여월
  계산과 무관한 표시용이라 이 모듈에 넣지 않았다.

## 테스트

`payrollDate.test.ts` — 원본 `lib/utils/payrollDate.test.ts`의 5개 케이스(console.log 수동 확인
스크립트였음)를 vitest 단언으로 이식 + `isHoliday` 콜백 동작 + 급여연월 경계값(마감일 당일 vs
다음날, 연도 경계) 케이스. 네트워크 호출이나 시스템 시간대에 의존하지 않는다.
