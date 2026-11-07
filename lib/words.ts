import { D, type Numeric } from "@/lib/money";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Integer → words in the Indian numbering system (thousand, lakh, crore). */
export function integerToWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
}

/** "Twelve Thousand Six Hundred Fifty Rupees and Four Paisa Only" */
export function amountInWords(value: Numeric, currency = "Rupees", minor = "Paisa"): string {
  const d = D(value).toDecimalPlaces(2);
  const negative = d.isNegative() && !d.isZero();
  const abs = d.abs();
  const whole = abs.floor();
  const paisa = abs.minus(whole).times(100).toDecimalPlaces(0).toNumber();
  const words = `${integerToWords(whole.toNumber())} ${currency}`;
  const minorWords = paisa ? ` and ${twoDigits(paisa)} ${minor}` : "";
  return `${negative ? "Minus " : ""}${words}${minorWords} Only`;
}
