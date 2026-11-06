import { expect, test } from '@playwright/test';
import { advanceClock, call, loginAs, makeUser, publishQuestion, resetClock, uid } from './helpers';

/**
 * Required flow: sign up → forecast → admin resolves and confirms (two people) →
 * score and league update → share card generated. Runs in Arabic (default locale).
 */
test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await resetClock();
});

test('sign up, forecast, two-person resolution, score + league update, share card', async ({ browser }) => {
  await resetClock();
  const id = uid();
  const editor = await makeUser(`ed_${id}`, 'EDITOR');
  const reviewer = await makeUser(`rv_${id}`, 'REVIEWER');

  // A question that resolves today (Riyadh) so it can also appear as a warm-up question.
  const riyadhNow = new Date(Date.now() + 3 * 3600_000);
  const minsToMidnight = 24 * 60 - (riyadhNow.getUTCHours() * 60 + riyadhNow.getUTCMinutes());
  const lockInMin = Math.max(2, Math.min(20, Math.floor(minsToMidnight / 2)));
  const resolveInMin = Math.max(lockInMin + 1, Math.min(120, minsToMidnight - 1));
  const q = await publishQuestion(editor.token, reviewer.token, {
    textAr: `هل سيغلق مؤشر تاسي على ارتفاع اليوم؟ (${id})`,
    textEn: `Will TASI close higher today? (${id})`,
    lockInMin,
    resolveInMin,
  });
  const [yes, no] = q.options;

  // 19 other forecasters: only 4 pick "yes", so a correct "yes" beats the crowd (5/20 = 25%).
  for (let i = 0; i < 19; i++) {
    const u = await makeUser(`crowd_${id}_${i}`);
    await call('/forecasts', { token: u.token, body: { questionId: q.id, optionId: i < 4 ? yes!.id : no!.id, confidence: 60 } });
  }

  // ---- sign up through the UI ----
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const phone = `05${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const nickname = `e2e_${id}`.slice(0, 20);
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByLabel('رقم الجوال السعودي').fill(phone);
  await page.getByRole('button', { name: 'أرسل الرمز' }).click();
  await expect(page.getByLabel('رمز التحقق (6 أرقام)')).toBeVisible();
  const { code } = await call<{ code: string }>(`/test/last-code?phone=${phone}`);
  await page.getByLabel('رمز التحقق (6 أرقام)').fill(code);
  await page.getByRole('button', { name: 'تحقق' }).click();

  await page.waitForURL(/onboarding/);
  await page.getByLabel('أؤكد أن عمري 18 سنة أو أكثر').check();
  await page.getByLabel('قرأت إشعار الخصوصية وأوافق عليه').check();
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByLabel('الاسم المستعار (يظهر للجميع)').fill(nickname);
  await page.getByLabel('المدينة').selectOption('jeddah');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect(page.getByRole('heading', { name: 'اختر 3 اهتمامات' })).toBeVisible();
  for (const c of ['تداول', 'النفط', 'تقنية']) await page.locator('label.chip', { hasText: c }).click();
  await page.getByRole('button', { name: 'متابعة' }).click();

  // warm-up: answer every question offered (up to 3, resolving today)
  await expect(page.getByRole('heading', { name: 'توقعات الإحماء' })).toBeVisible();
  const forms = page.locator('main form');
  const n = await forms.count();
  for (let i = 0; i < n; i++) {
    const f = forms.nth(i);
    await f.locator('input[type=radio]').first().check({ force: true });
    await f.getByRole('button').click();
    await expect(f.getByRole('status')).toBeVisible();
  }
  await page.getByRole('button', { name: 'ابدأ' }).click();
  await expect(page.getByRole('heading', { name: 'أسئلة اليوم' })).toBeVisible();

  // ---- forecast "yes" at 90% ----
  await page.goto(`/q/${q.id}`);
  await page.getByLabel('نعم', { exact: true }).check();
  await page.locator('label.chip', { hasText: '90' }).click();
  await page.getByRole('button', { name: /سجّل توقعي|حدّث توقعي/ }).click();
  await expect(page.getByText(/توقعك: .*نعم/)).toBeVisible();
  await expect(page.getByText(/20.*متوقِّع/)).toBeVisible(); // crowd revealed after answering

  // ---- move past lock; editor enters the outcome, a different reviewer confirms (UI) ----
  await advanceClock((lockInMin + 1) * 60_000);
  await call('/test/tick', { body: {} });
  const edCtx = await browser.newContext();
  await loginAs(edCtx, editor.token);
  const ed = await edCtx.newPage();
  await ed.goto(`/admin/q/${q.id}`);
  await expect(ed.getByText('مُقفل').first()).toBeVisible();
  await ed.locator('input[name=winner]').first().check();
  await ed.getByLabel('رابط مصدر النتيجة').fill('https://www.saudiexchange.sa/close');
  await ed.getByRole('button', { name: 'أدخل النتيجة' }).click();
  await expect(ed.getByText('يجب أن يؤكد النتيجة شخص مختلف.')).toBeVisible();

  const rvCtx = await browser.newContext();
  await loginAs(rvCtx, reviewer.token);
  const rv = await rvCtx.newPage();
  await rv.goto(`/admin/q/${q.id}`);
  await rv.getByRole('button', { name: 'أكّد النتيجة وشغّل الاحتساب' }).click();
  await expect(rv.getByText('محسوم').first()).toBeVisible();

  // ---- the user sees the score, league update and the share card ----
  await page.goto(`/q/${q.id}`);
  await expect(page.getByText(/النتيجة: .*نعم/)).toBeVisible();
  await expect(page.getByText(/نتيجتك: .*\+85/)).toBeVisible();

  await page.goto('/league');
  const myRow = page.locator('tr[aria-current=true]');
  await expect(myRow).toContainText(nickname);
  await expect(myRow).toContainText('+85');

  // share cards are rendered by a background job: reload until ours is listed
  const card = page.locator('img[src^="/api/share/"]').first();
  await expect(async () => {
    await page.goto('/me');
    await expect(card).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText('تفوّقت على الجمهور').first()).toBeVisible();
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1200);

  // English walkthrough of the same screen
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByText('Beat the Crowd').first()).toBeVisible();
  await expect(page.getByText('Season points')).toBeVisible();
});
