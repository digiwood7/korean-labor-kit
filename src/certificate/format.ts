/**
 * 재직증명서용 순수 포맷 함수 (날짜 포맷 · 주민등록번호 표기 변환)
 *
 * 원본의 `lib/certificate/format.ts`를 그대로 이식했다. 전부 순수 함수라
 * 프레임워크/DB에 종속되지 않는다.
 */

/** ISO("YYYY-MM-DD") → "YYYY년 M월 D일". 빈 값·형식 오류면 "" */
export function formatDateKr(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 주민등록번호 → 생년월일("YYYY년 M월 D일"). 형식 오류 시 "".
 * 성별코드로 세기를 판정한다: 1·2·5·6 → 1900년대 / 3·4·7·8 → 2000년대 / 9·0 → 1800년대.
 */
export function residentIdToBirthDate(rid: string | null | undefined): string {
  if (!rid) return "";
  const digits = rid.replace(/[^0-9]/g, "");
  if (digits.length < 7) return "";
  const yy = digits.substring(0, 2);
  const mm = digits.substring(2, 4);
  const dd = digits.substring(4, 6);
  const genderCode = digits.charAt(6);
  let century: number;
  if ("12".includes(genderCode)) century = 1900;
  else if ("34".includes(genderCode)) century = 2000;
  else if ("56".includes(genderCode)) century = 1900; // 외국인 1900년대
  else if ("78".includes(genderCode)) century = 2000; // 외국인 2000년대
  else if ("90".includes(genderCode)) century = 1800;
  else return "";
  const year = century + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 주민등록번호 표기 방식.
 * - `birth`: 생년월일 문자열로 변환(뒷자리 노출 안 함).
 * - `mask`: 앞 6자리 + 성별코드 1자리 + 나머지 6자리를 별표 처리.
 * - `full`: 원본 그대로.
 */
export type MaskMode = "birth" | "mask" | "full";

/** 주민등록번호를 표기 방식에 따라 변환한다. 빈 값이면 "" */
export function maskResidentId(rid: string | null | undefined, mode: MaskMode): string {
  if (!rid) return "";
  if (mode === "birth") return residentIdToBirthDate(rid);
  if (mode === "full") return rid;
  // mask: 앞 6자리 + 성별코드 1자리 + 나머지 6자리 별표
  const digits = rid.replace(/[^0-9]/g, "");
  if (digits.length < 7) return rid;
  return `${digits.substring(0, 6)}-${digits.charAt(6)}******`;
}
