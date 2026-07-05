# src/holidays — 한국 공휴일 조회 (KASI 특일정보 API)

한국천문연구원(KASI) 특일정보 API로 대한민국 관공서 공휴일(대체공휴일 포함)을 조회한다.
연도별 결과는 인스턴스 메모리에 캐시되며, API 키가 없으면 내장 폴백 표(2025~2027)를 쓴다.

## 구성 파일

- `holidays.ts` — `HolidayClient` 클래스(조회·캐시·폴백)와 순수 함수 `isWeekend`.
- `fallbackHolidays.ts` — API 불가 시 사용하는 내장 공휴일 표(공개 정보).

## API 키 발급

1. [공공데이터포털](https://www.data.go.kr)에서 **"한국천문연구원 특일 정보"** 활용신청.
2. 마이페이지 → "일반 인증키(Decoding)" 값을 복사.
3. 환경변수 `HOLIDAY_API_KEY`에 넣거나, 생성자 옵션 `apiKey`로 직접 주입.

키가 없어도 동작한다(내장 폴백 표 사용). 단 폴백은 2025~2027만 담고 있으니, 그 외 연도나 최신
개정 반영이 필요하면 API 키를 넣는 것을 권장한다.

## 빠른 사용법

```ts
import { HolidayClient } from "korean-labor-kit/holidays";

const client = new HolidayClient({ apiKey: process.env.HOLIDAY_API_KEY });

await client.isHoliday("2026-03-01");            // true (삼일절)
await client.isWeekendOrHoliday("2026-03-07");   // true (토요일)
const set = await client.getHolidays(2026);      // Set<"YYYY-MM-DD">
const names = await client.getHolidayNames(2026); // Map<날짜, 이름> (대체공휴일 포함)
```

## 생성자 옵션 (`HolidayClientOptions`)

```ts
new HolidayClient({
  apiKey,       // KASI 서비스 키. 미지정 시 env HOLIDAY_API_KEY 폴백. 둘 다 없으면 내장 표.
  fetch,        // fetch 구현 주입(테스트용). 미지정 시 전역 fetch.
  fallback,     // 폴백 공휴일 표 교체(연도 → { "YYYY-MM-DD": 이름 }).
});
```

## 메서드

- `getHolidays(year)` → `Set<string>` 공휴일 날짜 집합(캐시).
- `getHolidayNames(year)` → `Map<string,string>` 날짜 → 이름.
- `isHoliday(date)` → `boolean` (Date 또는 "YYYY-MM-DD").
- `isWeekendOrHoliday(date)` → `boolean`.
- `getHolidayData(year)` → `{ dates: string[], names: Record<string,string> }` (JSON 직렬화용).
- `isWeekend(date)` — 공휴일 조회 없이 주말만 즉시 판정하는 순수 함수(클래스 밖 export).

## 원본과 달라진 점

- **프레임워크 종속 제거**: 원본은 Next.js 서버/브라우저 겸용으로, 브라우저에서는 `/api/holidays`
  라우트를 호출했다. 이 킷은 순수 Node 라이브러리라 `typeof window`/`/api/holidays` 분기를 없앴다.
- **시크릿 주입화**: API 키를 모듈 로드 시 `process.env`에서 바로 읽던 것을, 생성자 옵션으로
  주입하고 없으면 env 폴백하도록 바꿨다(공개 repo이므로 키를 코드에 두지 않는다).
- **fetch 주입화**: 테스트에서 실제 네트워크 없이 검증할 수 있게 `fetch`를 주입 가능하게 했다.
- **캐시 범위**: 전역 모듈 캐시 대신 인스턴스별 캐시로 바꿔 소비자/테스트 간 상태가 섞이지 않는다.

## 대체공휴일

KASI API는 대체공휴일을 `isHoliday: "Y"` 항목으로 함께 내려주고, 내장 폴백 표에도 대체공휴일이
포함돼 있다. 별도 계산 없이 조회 결과에 그대로 반영된다.

## 테스트

`holidays.test.ts`는 **실제 API를 절대 호출하지 않는다.** mock `fetch`를 주입해 다음을 검증한다:
월별 응답 파싱, 배열/단일객체/빈응답 처리, `isHoliday="N"` 제외, 대체공휴일 포함, 연도 캐시(추가
호출 없음), HTTP 오류 시 폴백, 키 없을 때 폴백 표 사용, `fallback` 옵션 교체, `isWeekend` 순수 함수.
