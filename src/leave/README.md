# src/leave — 연차(연차유급휴가) 계산

근로기준법 기준 연차 발생일수·가산연차·주기 이월 차감을 계산하는 **순수 함수** 모음이다.
원본의 `lib/leave/`에서 계산 로직만 뽑아왔고, DB(Supabase) 조회·저장 코드는 이식하지 않았다.
모든 함수는 "값 입력 → 값 출력"이라 저장소/프레임워크에 종속되지 않는다.

## 연차 규칙 요약

- **1년 미만**: 연차 기준일 이후 1개월(캘린더 월수) 초과마다 1일 발생, 최대 11일.
- **1년 이상**: 기본 15일. 3년차부터 2년마다 1일씩 가산(`15 + floor((근속년수-1)/2)`), 최대 25일.
- **주기(cycle)**: 연차 기준일(입사일 등)을 기준으로 12개월 단위. 1차년도=`cycleYear 1`.
- **이월**: 전년도 잔여가 **음수(당겨쓴 빚)**면 그만큼 새 주기 발생량에서 차감. 양수 잔여는 소멸.

## 구성 파일

- `constants.ts` — 한도/기본일수/가산 규칙 상수.
- `utils.ts` — 날짜 차이(월/년), 주기 연도/기간 계산 등 순수 유틸.
- `accrual.ts` — 발생일수 계산(`calculateFirstYearLeave`, `calculateRegularLeave`, `calculateTotalLeaveByCycle`).
- `cycleSeed.ts` — 새 주기 초기값(발생·이월차감·실부여) 계산(`computeNewCycleSeed`).
- `healthLeave.ts` — 보건휴가(무급) 1일 급여 공제액(`healthLeaveDeduction`).

## 빠른 사용법

```ts
import {
  calculateTotalLeaveByCycle,
  getLeaveCycleYear,
  computeNewCycleSeed,
  healthLeaveDeduction,
} from "korean-labor-kit/leave";

// 이 직원은 지금 몇 차년도인가?
const cycle = getLeaveCycleYear("2024-06-01", new Date("2026-07-05")); // 3

// 3차년도 발생량
calculateTotalLeaveByCycle("2024-06-01", 3); // 15

// 새 주기 초기값(전년도 잔여 -0.5일 = 0.5일 당겨씀)
computeNewCycleSeed({ leaveStartDate: "2024-06-01", currentCycle: 3, prevRemaining: -0.5 });
// { grant: 15, carryDebt: 0.5, total: 14.5, used: 0 }

// 보건휴가 1일 급여 공제(시간당 통상임금 15,072원 × 8h)
healthLeaveDeduction(15072); // 120576
```

## DB 연동은 호출측 책임

원본은 "현재 주기 행이 없으면 이월을 반영해 새로 만드는" 로직에 Supabase 조회/삽입이
섞여 있었다. 이 킷은 **계산만** 제공하므로, 실제 저장은 아래처럼 각 서비스가 자기 DB로 처리한다.

```ts
// 1) 직전 주기 잔여를 내 DB에서 구한다 (발생량 - 승인휴가 합계)
const prevRemaining = prevEntitlement - prevUsedFromMyDb;

// 2) 새 주기 초기값을 이 킷으로 계산한다
const seed = computeNewCycleSeed({ leaveStartDate, currentCycle, prevRemaining });

// 3) 내 DB에 INSERT (total_days = seed.total)
await myDb.insertLeaveBalance({ cycleYear: currentCycle, total: seed.total, used: seed.used });
```

## 테스트

- `cycleSeed.test.ts` — 원본 `lib/leave/cycleSeed.test.ts`를 이식(이월 차감/가산/0.5단위 정리).
- `healthLeave.test.ts` — 원본 `lib/leave/healthLeave.test.ts`를 이식(공제액/반올림/0 처리).
- `accrual.test.ts` — 발생일수·가산·최대한도 산식을 고정하는 신규 테스트.

모든 테스트는 `targetDate`를 명시해 "오늘 날짜"에 의존하지 않는다.

## 날짜/시간대 주의

계산 자체는 **타임존 무관**이다. 내부에서 날짜 문자열을 `new Date(y, m-1, d)`(로컬 자정)으로
파싱하고 로컬 게터(`getFullYear`/`getMonth`/`getDate`)로만 비교하므로, 실행 환경이 KST든 UTC든
America/New_York든 항상 같은 달력 날짜를 가리킨다. 다만 값을 넘길 때·받을 때 두 가지만 지키면 된다.

- **`targetDate`로 `Date`를 넘길 땐 로컬 자정으로 만든다.** `new Date(2026, 6, 5)` 또는
  `new Date("2026-07-05T00:00:00")`처럼 로컬 자정 Date를 준다. `new Date("2026-07-05")`는 UTC
  자정으로 파싱되어 음수 오프셋 타임존에서 하루 전날로 밀릴 수 있으니 피한다.
- **반환된 `Date`(예: `getLeaveCyclePeriod`의 시작·종료일)는 로컬 자정이다.** 문자열로 포맷할 땐
  `toISOString()`(UTC 기준이라 하루 어긋날 수 있음)이 아니라 로컬 게터로 조립한다.
  예) `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` ``
