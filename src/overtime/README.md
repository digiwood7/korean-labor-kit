# src/overtime — 연장·야간·휴일 근로수당 계산

근로기준법 제56조 배율을 분(minute) 단위로 적용해 연장·야간·휴일 근로수당을 계산한다.
회사마다 다른 취업규칙(토요일 취급, 야간 시간대)은 옵션으로 조정할 수 있고, **옵션을 주지
않으면 법정 기본값으로 계산되어 결과가 원본과 100% 동일**하다.

## 배율 매트릭스 (통상임금 대비)

|                     | 평일(소정근로일) | 토요일(무급휴무일) | 일요일/휴일(유급주휴일·공휴일) |
|---------------------|:---:|:---:|:---:|
| 8h이내 주간(06~22)   | 1.0 | 1.5 | 1.5 |
| 8h초과 주간(06~22)   | 1.5 | 1.5 | 2.0 |
| 8h이내 야간(22~06)   | 1.5 | 2.0 | 2.0 |
| 8h초과 야간(22~06)   | 2.0 | 2.0 | 2.5 |

- 평일 연장근로는 소정 8시간을 이미 채운 "초과" 근로이므로 `priorHours=8`로 계산한다.
- 토/일/공휴일 근로와 주말출장은 그날 처음부터 근로하므로 `priorHours=0`.

## 구성 파일

- `laborPay.ts` — 핵심 계산기(`calcLaborPay`)와 편의 함수(`calcRegularOvertimePay`, `calcWeekendTripPay`), 요일 판정(`getDayType`), 배율표(`LABOR_MULTIPLIERS`).
- `weekendTrip.ts` — 주말출장 식별 상수와 최소 보장금액 처리(`resolveTripMinAmount`).

## 빠른 사용법

```ts
import { calcRegularOvertimePay, calcWeekendTripPay } from "korean-labor-kit/overtime";

// 평일 연장 18:00~20:00, 시간당 통상임금 10,000원
const ot = calcRegularOvertimePay({
  date: "2026-06-15",
  startTime: "18:00",
  endTime: "20:00",
  ordinaryWage: 10000,
});
// ot.weightedHours = 3 (2h × 1.5), ot.amount = 30,000원

// 주말출장(최소 8만원 보장)
const trip = calcWeekendTripPay({
  date: "2026-06-14", // 일요일
  startTime: "09:00",
  endTime: "18:00",
  ordinaryWage: 15072,
  minAmount: 80000,
});
// trip.weightedHours = 14 (8×1.5 + 1×2.0), trip.amount = 211,008원
```

### 공휴일 판정

`getDayType(date, holidays?)`는 일요일을 `holiday`, 토요일을 `saturday`로 보고, `holidays`
집합에 날짜가 있으면 `holiday`로 판정한다. 공휴일 집합은 [`src/holidays`](../holidays/README.md)의
`HolidayClient.getHolidays(year)`로 만들 수 있다.

```ts
const holidays = await new HolidayClient({ apiKey }).getHolidays(2026);
calcRegularOvertimePay({ date: "2026-03-01", startTime: "09:00", endTime: "18:00", ordinaryWage: 10000, holidays });
// 삼일절이 holidays에 있으면 휴일 배율로 계산된다
```

## 취업규칙 옵션 (`WorkRuleOptions`) — 이 킷에서 추가한 개량

원본은 배율표가 고정이었다. 이 킷은 회사별 취업규칙을 옵션으로 받는다:

```ts
type WorkRuleOptions = {
  saturdayType?: "unpaid_holiday" | "paid_holiday"; // 기본: unpaid_holiday(무급휴무일)
  nightRange?: { start: number; end: number };      // 기본: { start: 22, end: 6 }
};
```

- **`saturdayType: "paid_holiday"`** — 토요일을 유급휴일로 두는 회사는 토요일에도 일요일/공휴일
  열(8h이내 1.5 / 8h초과 2.0)을 적용한다. 기본값(`"unpaid_holiday"`)이면 토요일 열(전부 1.5)로,
  원본과 동일하게 계산한다.
- **`nightRange`** — 야간 가산 시간대를 시(hour) 단위로 바꾼다. `start > end`(예: 22~6)면 자정을
  넘는 구간으로, `start < end`(예: 0~6)면 자정 안 넘는 단순 구간으로 해석한다.

```ts
calcRegularOvertimePay({
  date: "2026-06-13", // 토요일
  startTime: "09:00", endTime: "19:00", ordinaryWage: 10000,
  breakStart: "12:00", breakEnd: "13:00",
  workRule: { saturdayType: "paid_holiday" },
});
// 기본: 9h × 1.5 = 13.5 → paid_holiday: 8×1.5 + 1×2.0 = 14
```

## 테스트

`laborPay.test.ts`는 두 블록으로 나뉜다.

- **기존 이식** — 원본 `lib/overtime/laborPay.test.ts`의 단언을 그대로 옮겼다. 옵션을 주지 않은
  기본 동작이 원본과 동일함을 증명한다.
- **옵션 분기** — `saturdayType`/`nightRange` 옵션이 켜졌을 때만 결과가 달라지고, 옵션이 없거나
  다른 요일에는 영향이 없음을 검증한다.
