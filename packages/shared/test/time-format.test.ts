import { describe, expect, it } from 'vitest';
import {
  autoChecklist,
  buildFromTemplate,
  findBlockedTopics,
  formatDateTime,
  formatNumber,
  formatTime,
  isQuietHours,
  nextAllowedNotificationTime,
  normalizeSaudiPhone,
  riyadhDay,
  seasonWindow,
  TEMPLATES,
  weekStart,
} from '../src';

describe('Riyadh time', () => {
  it('week starts Sunday 00:00 Riyadh (Sat 21:00 UTC)', () => {
    // Friday 2026-11-06 15:00 UTC -> week of Sunday 2026-11-01
    expect(weekStart(new Date('2026-11-06T15:00:00Z')).toISOString()).toBe('2026-10-31T21:00:00.000Z');
    // Saturday 21:00 UTC is Sunday 00:00 Riyadh: new week
    expect(weekStart(new Date('2026-11-07T21:00:00Z')).toISOString()).toBe('2026-11-07T21:00:00.000Z');
    expect(weekStart(new Date('2026-11-07T20:59:59Z')).toISOString()).toBe('2026-10-31T21:00:00.000Z');
  });
  it('riyadhDay rolls over at 21:00 UTC', () => {
    expect(riyadhDay(new Date('2026-11-06T20:59:00Z'))).toBe('2026-11-06');
    expect(riyadhDay(new Date('2026-11-06T21:00:00Z'))).toBe('2026-11-07');
  });
  it('seasons are 6 weeks from the anchor Sunday', () => {
    const s = seasonWindow(new Date('2026-01-04T00:00:00+03:00'));
    expect(s.index).toBe(0);
    expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(42 * 86400_000);
    expect(seasonWindow(new Date('2026-02-15T00:00:00+03:00')).index).toBe(1);
  });
});

describe('quiet hours 23:00-07:00 Riyadh', () => {
  it('detects quiet hours', () => {
    expect(isQuietHours(new Date('2026-11-06T20:00:00Z'))).toBe(true); // 23:00
    expect(isQuietHours(new Date('2026-11-06T03:59:00Z'))).toBe(true); // 06:59
    expect(isQuietHours(new Date('2026-11-06T04:00:00Z'))).toBe(false); // 07:00
    expect(isQuietHours(new Date('2026-11-06T19:59:00Z'))).toBe(false); // 22:59
  });
  it('defers to the next 07:00', () => {
    expect(nextAllowedNotificationTime(new Date('2026-11-06T21:30:00Z')).toISOString()).toBe('2026-11-07T04:00:00.000Z'); // 00:30 -> 07:00 same day
    expect(nextAllowedNotificationTime(new Date('2026-11-06T20:30:00Z')).toISOString()).toBe('2026-11-07T04:00:00.000Z'); // 23:30 -> next day 07:00
    const ok = new Date('2026-11-06T10:00:00Z');
    expect(nextAllowedNotificationTime(ok)).toBe(ok);
  });
});

describe('formatting uses Western numerals and Gregorian dates in Arabic', () => {
  it('numbers', () => {
    expect(formatNumber(1234, 'ar')).toMatch(/^1[,٬]?234$/);
    expect(formatNumber(-232, 'ar')).not.toMatch(/[٠-٩]/);
  });
  it('dates', () => {
    const s = formatDateTime(new Date('2026-11-06T15:00:00Z'), 'ar');
    expect(s).not.toMatch(/[٠-٩]/);
    expect(s).toContain('2026');
    expect(formatTime(new Date('2026-11-06T15:00:00Z'), 'ar')).toBe('18:00'); // Riyadh = UTC+3
    expect(formatTime(new Date('2026-11-06T15:00:00Z'), 'en')).toBe('18:00');
  });
});

describe('phone normalization', () => {
  it.each([
    ['0501234567', '+966501234567'],
    ['+966501234567', '+966501234567'],
    ['00966 50 123 4567', '+966501234567'],
    ['٠٥٠١٢٣٤٥٦٧', '+966501234567'],
    ['501234567', '+966501234567'],
  ])('%s -> %s', (i, o) => expect(normalizeSaudiPhone(i)).toBe(o));
  it.each(['0111234567', '+14155550100', '05012'])('rejects %s', (i) => expect(normalizeSaudiPhone(i)).toBeNull());
});

describe('publish checklist automatic checks', () => {
  const base = {
    textAr: 'هل سيغلق مؤشر تاسي على ارتفاع اليوم؟',
    textEn: 'Will TASI close higher today?',
    options: [
      { labelAr: 'نعم', labelEn: 'Yes' },
      { labelAr: 'لا', labelEn: 'No' },
    ],
    sourceName: 'Saudi Exchange',
    sourceUrl: 'https://www.saudiexchange.sa/',
    lockAt: new Date('2026-11-06T07:00:00Z'),
    resolveBy: new Date('2026-11-06T13:00:00Z'),
  };
  const now = new Date('2026-11-06T05:00:00Z');
  it('passes a valid question', () => {
    expect(Object.values(autoChecklist(base, now)).every(Boolean)).toBe(true);
  });
  it('fails when resolving more than 24h after publish', () => {
    expect(autoChecklist({ ...base, resolveBy: new Date('2026-11-07T06:00:00Z') }, now).resolvesWithin24h).toBe(false);
  });
  it('fails duplicate options, http URLs, blocked topics and lock after resolve', () => {
    expect(autoChecklist({ ...base, options: [base.options[0]!, base.options[0]!] }, now).optionsValid).toBe(false);
    expect(autoChecklist({ ...base, sourceUrl: 'http://x.com' }, now).sourceUrlValid).toBe(false);
    expect(autoChecklist({ ...base, textEn: 'Will the minister announce sanctions?' }, now).noBlockedKeywords).toBe(false);
    expect(autoChecklist({ ...base, lockAt: new Date('2026-11-06T14:00:00Z') }, now).lockBeforeResolve).toBe(false);
  });
  it('blocked-topic scan does not flag "Kingdom"', () => {
    expect(findBlockedTopics('Will Kingdom Tower light up green?')).toEqual([]);
    expect(findBlockedTopics('Will the king attend?')).toEqual(['royal']);
  });
  it('templates produce checklist-valid drafts when published in time', () => {
    for (const t of TEMPLATES) {
      const params: Record<string, string> = { day: '2026-11-08', threshold: '75', homeAr: 'الهلال', homeEn: 'Al Hilal', awayAr: 'النصر', awayEn: 'Al Nassr', kickoff: '2026-11-08T18:00:00Z' };
      const d = buildFromTemplate(t.key, params);
      const publishAt = new Date(d.resolveBy.getTime() - 20 * 3600_000);
      const res = autoChecklist(d, publishAt.getTime() < d.lockAt.getTime() ? publishAt : new Date(d.lockAt.getTime() - 3600_000));
      expect(res, t.key).toMatchObject({ noBannedWords: true, noBlockedKeywords: true, optionsValid: true, sourceUrlValid: true, lockBeforeResolve: true });
    }
  });
});
