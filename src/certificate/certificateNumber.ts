/**
 * 발급번호 채번 — 순수 함수
 *
 * 원본은 "연도별 일련번호"를 DB(certificate_issue_logs)에서 최대 seq를 읽어
 * `${year}-${seq를 4자리로}` 형태로 만들었다. 여기서는 그 채번 규칙만 순수 함수로 뽑았다.
 * "직전 번호가 무엇인지"는 각자 자기 저장소에서 구해 넘긴다(이 킷은 DB를 모른다).
 */

export interface CertificateNumberOptions {
  /** 일련번호 자릿수(0 채움). 기본 4 → "0001" */
  pad?: number;
  /** 접두사와 일련번호 사이 구분자. 기본 "-" */
  separator?: string;
}

/**
 * 다음 발급번호를 만든다.
 *
 * @param prefix 접두사(보통 발급연도). 예: 2026 또는 "2026"
 * @param lastNo 같은 접두사에서 마지막으로 쓴 일련번호. 아직 없으면 0.
 * @returns `"{prefix}{separator}{next를 pad자리로}"` (예: "2026-0001")
 *
 * @example
 * nextCertificateNumber(2026, 0);          // "2026-0001"
 * nextCertificateNumber(2026, 41);         // "2026-0042"
 * nextCertificateNumber("HR", 7, { pad: 3, separator: "/" }); // "HR/008"
 */
export function nextCertificateNumber(
  prefix: string | number,
  lastNo: number,
  options: CertificateNumberOptions = {},
): string {
  const pad = options.pad ?? 4;
  const separator = options.separator ?? "-";
  const base = Number.isFinite(lastNo) ? Math.floor(lastNo) : 0;
  const next = base + 1;
  const seq = next < 1 ? 1 : next;
  return `${prefix}${separator}${String(seq).padStart(pad, "0")}`;
}

/**
 * 발급번호에서 일련번호(숫자)만 되읽는다. 형식이 안 맞으면 null.
 * 여러 발급번호 중 최대값을 골라 `nextCertificateNumber`에 넘길 때 쓴다.
 *
 * @param certificateNumber 예: "2026-0042"
 * @param separator 채번에 쓴 구분자(기본 "-")
 */
export function parseCertificateSeq(
  certificateNumber: string | null | undefined,
  separator = "-",
): number | null {
  if (!certificateNumber) return null;
  const idx = certificateNumber.lastIndexOf(separator);
  if (idx < 0) return null;
  const tail = certificateNumber.slice(idx + separator.length);
  if (!/^\d+$/.test(tail)) return null;
  return Number(tail);
}
