import { expect, test } from '@playwright/test';
import { findBannedWords } from '@app/shared';
import { advanceClock, call, loginAs, makeUser, publishQuestion, resetClock, uid } from './helpers';

/** Required flow: a full SINGLE duel between two users, decided by a two-person resolution. */
test.afterAll(async () => {
  await resetClock();
});

test('full duel: create, share link, accept with a different answer, resolve, result + Elo + share card', async ({ browser }) => {
  await resetClock();
  const id = uid();
  const editor = await makeUser(`ed_${id}`, 'EDITOR');
  const reviewer = await makeUser(`rv_${id}`, 'REVIEWER');
  const a = await makeUser(`duelA_${id}`.slice(0, 20));
  const b = await makeUser(`duelB_${id}`.slice(0, 20));
  const q = await publishQuestion(editor.token, reviewer.token, {
    textAr: `ما نتيجة مباراة الهلال والنصر؟ (${id})`,
    textEn: `What will be the result of Al Hilal vs Al Nassr? (${id})`,
    categorySlug: 'spl',
    lockInMin: 30,
    resolveInMin: 180,
    options: [
      { labelAr: 'فوز الهلال', labelEn: 'Al Hilal win' },
      { labelAr: 'تعادل', labelEn: 'Draw' },
      { labelAr: 'فوز النصر', labelEn: 'Al Nassr win' },
    ],
  });

  // challenger creates the duel from the question page
  const ca = await browser.newContext();
  await loginAs(ca, a.token);
  const pa = await ca.newPage();
  await pa.goto(`/q/${q.id}`);
  await pa.getByRole('link', { name: 'تحدَّ صديقاً على هذا السؤال' }).click();
  await expect(pa.getByRole('heading', { name: 'تحدٍّ جديد' })).toBeVisible();
  await pa.getByLabel('فوز الهلال').check();
  await pa.getByRole('button', { name: 'أرسل التحدي' }).click();
  await expect(pa.getByText('بانتظار القبول')).toBeVisible();
  const link = await pa.getByLabel('رابط التحدي').inputValue();
  expect(link).toMatch(/\/duels\//);
  expect(findBannedWords(await pa.locator('body').innerText())).toEqual([]); // duel screens must not use banned vocabulary

  // opponent opens the shared link; the challenger's answer is disabled for them
  const cb = await browser.newContext();
  await loginAs(cb, b.token);
  const pb = await cb.newPage();
  await pb.goto(new URL(link).pathname);
  await expect(pb.getByRole('radio', { name: 'فوز الهلال' })).toBeDisabled();
  await pb.getByRole('radio', { name: 'فوز النصر' }).check();
  await pb.getByRole('button', { name: 'اقبل التحدي' }).click();
  await expect(pb.getByText('جارٍ', { exact: true })).toBeVisible();
  expect(findBannedWords(await pb.locator('body').innerText())).toEqual([]);

  // two-person resolution (API): Al Hilal wins
  await advanceClock(31 * 60_000);
  await call('/test/tick', { body: {} });
  await call(`/admin/questions/${q.id}/resolve`, { token: editor.token, body: { winningOptionId: q.options[0]!.id, sourceUrl: 'https://www.spl.com.sa/match' } });
  await call(`/admin/questions/${q.id}/confirm`, { token: reviewer.token, body: {} });

  await pa.reload();
  await expect(pa.getByText('فزت بالتحدي!')).toBeVisible();
  await pb.reload();
  await expect(pb.getByText('فاز منافسك هذه المرة')).toBeVisible();

  // Elo moved (1200 -> 1216 / 1184) and is shown separately from points
  await pa.goto('/duels');
  await expect(pa.getByText(/تصنيف التحدي: .*1,?216/)).toBeVisible();
  await pb.goto('/duels');
  await expect(pb.getByText(/تصنيف التحدي: .*1,?184/)).toBeVisible();

  // winner's share card exists and renders
  const card = pa.locator('img[src^="/api/share/"]').first();
  await expect(async () => {
    await pa.goto('/me');
    await expect(card).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);
  // duels never change season points
  const summary = await call('/me/summary', { token: a.token });
  expect(summary.stats.seasonPoints).toBe(0);
  expect(summary.badges.map((x: { badge: string }) => x.badge)).toContain('DUEL_WIN_1');
});
