import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNED_WORDS_AR, findBannedWords, identifierHasBannedWords } from '../src';

const ROOT = resolve(__dirname, '../../..');

/** Every UI translation file: all user-facing copy lives here. */
const TRANSLATION_DIRS = ['apps/web/messages'];

/** Source trees scanned for code, comments and hard-coded copy (rule 4). */
const SOURCE_DIRS = ['apps/web/app', 'apps/web/components', 'apps/web/lib', 'apps/web/public', 'apps/api/src', 'packages/shared/src', 'packages/db/prisma', 'e2e/tests'];
const EXTENSIONS = /\.(ts|tsx|js|mjs|json|css|prisma|webmanifest)$/;
/** The single file allowed to contain the banned vocabulary (it defines it). */
const ALLOWED = new Set(['packages/shared/src/banned-words.ts']);

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e === 'dist' || e === 'migrations') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (EXTENSIONS.test(e)) out.push(p);
  }
  return out;
}

function flatten(obj: unknown, prefix = ''): [string, string][] {
  if (typeof obj === 'string') return [[prefix, obj]];
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  return [];
}

describe('banned vocabulary', () => {
  it('detects English and Arabic forms', () => {
    expect(findBannedWords('What are the ODDS?')).toEqual(['odds']);
    expect(findBannedWords('place a bet')).toEqual(['bet']);
    expect(findBannedWords('هذا رهان')).toEqual(['رهان']);
    expect(findBannedWords('المراهنة ممنوعة')).toContain('مراهنة');
    expect(findBannedWords('between the alphabet, a better mistake')).toEqual([]);
    expect(identifierHasBannedWords('jackpot_king')).toBe(true);
    expect(identifierHasBannedWords('Alphabet')).toBe(false);
  });

  const translationFiles = TRANSLATION_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => f.endsWith('.json'));

  it('finds the Arabic and English translation files', () => {
    const names = translationFiles.map((f) => relative(ROOT, f)).sort();
    expect(names).toEqual(['apps/web/messages/ar.json', 'apps/web/messages/en.json']);
  });

  it.each(translationFiles.map((f) => [relative(ROOT, f), f]))('translation file %s has no banned words', (_name, file) => {
    const hits = flatten(JSON.parse(readFileSync(file, 'utf8')))
      .map(([key, value]) => ({ key, words: findBannedWords(value) }))
      .filter((h) => h.words.length > 0);
    expect(hits).toEqual([]);
  });

  it('ar and en translation files have the same keys', () => {
    const keys = (f: string) => flatten(JSON.parse(readFileSync(join(ROOT, 'apps/web/messages', f), 'utf8'))).map(([k]) => k).sort();
    expect(keys('ar.json')).toEqual(keys('en.json'));
  });

  it('no source file (code, comments or copy) uses banned words', () => {
    const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => !ALLOWED.has(relative(ROOT, f)));
    expect(files.length).toBeGreaterThan(50);
    const hits = files
      .map((f) => {
        const text = readFileSync(f, 'utf8');
        const words = findBannedWords(text).concat(BANNED_WORDS_AR.filter((w) => text.includes(w)));
        return { file: relative(ROOT, f), words: [...new Set(words)] };
      })
      .filter((h) => h.words.length > 0);
    expect(hits).toEqual([]);
  });
});
