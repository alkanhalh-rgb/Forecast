/** Normalizes Saudi mobile numbers to E.164 (+9665XXXXXXXX). Returns null when invalid. */
export function normalizeSaudiPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  let n = digits;
  if (n.startsWith('+966')) n = n.slice(4);
  else if (n.startsWith('00966')) n = n.slice(5);
  else if (n.startsWith('966')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  if (!/^5\d{8}$/.test(n)) return null;
  return `+966${n}`;
}
