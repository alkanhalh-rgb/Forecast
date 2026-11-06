export type Dict = Record<string, unknown>;

/** Looks up "a.b.c" and replaces {name} placeholders. Missing keys return the key (visible in QA). */
export function translate(dict: Dict, key: string, params?: Record<string, string | number>): string {
  let v: unknown = dict;
  for (const part of key.split('.')) v = v && typeof v === 'object' ? (v as Dict)[part] : undefined;
  if (typeof v !== 'string') return key;
  return params ? v.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`)) : v;
}
