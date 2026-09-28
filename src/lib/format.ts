const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => persianDigits[Number(d)]);
}

export function formatToman(amount: number): string {
  return `${toFaDigits(amount.toLocaleString("en-US"))} تومان`;
}
