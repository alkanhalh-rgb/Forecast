import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { call, loginAs, makeUser, publishQuestion, uid } from './helpers';

/** WCAG 2.x AA checks (contrast, labels, landmarks) on the main screens, in Arabic and English. */
test('main screens have no serious or critical axe violations (ar + en)', async ({ browser }) => {
  const id = uid();
  const editor = await makeUser(`ed_${id}`, 'EDITOR');
  const reviewer = await makeUser(`rv_${id}`, 'REVIEWER');
  const user = await makeUser(`a11y_${id}`.slice(0, 20));
  const q = await publishQuestion(editor.token, reviewer.token, { textAr: `سؤال اختبار الوصول ${id}؟`, textEn: `Accessibility test question ${id}?`, lockInMin: 60, resolveInMin: 120 });
  await call('/forecasts', { token: user.token, body: { questionId: q.id, optionId: q.options[0]!.id, confidence: 75 } });

  const pages = ['/', `/q/${q.id}`, '/league', '/leaderboards', '/duels', '/duels/new', '/friends', '/me'];
  for (const locale of ['ar', 'en']) {
    const ctx = await browser.newContext();
    await loginAs(ctx, user.token);
    await ctx.addCookies([{ name: 'locale', value: locale, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    for (const path of [...pages, '/login']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${locale} ${path}: ${v.id} (${v.nodes.length})`);
      expect(bad, bad.join('\n')).toEqual([]);
    }
    // admin console for staff
    const sctx = await browser.newContext();
    await loginAs(sctx, editor.token);
    await sctx.addCookies([{ name: 'locale', value: locale, domain: 'localhost', path: '/' }]);
    const sp = await sctx.newPage();
    for (const path of ['/admin', '/admin/new', `/admin/q/${q.id}`]) {
      await sp.goto(path);
      await sp.waitForLoadState('networkidle');
      const res = await new AxeBuilder({ page: sp }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${locale} ${path}: ${v.id} (${v.nodes.length})`);
      expect(bad, bad.join('\n')).toEqual([]);
    }
  }
});

test('keyboard: skip link and forecast form are operable without a mouse', async ({ browser }) => {
  const id = uid();
  const editor = await makeUser(`ed_${id}`, 'EDITOR');
  const reviewer = await makeUser(`rv_${id}`, 'REVIEWER');
  const user = await makeUser(`kb_${id}`.slice(0, 20));
  const q = await publishQuestion(editor.token, reviewer.token, { textAr: `سؤال لوحة المفاتيح ${id}؟`, textEn: `Keyboard question ${id}?`, lockInMin: 60, resolveInMin: 120 });
  const ctx = await browser.newContext();
  await loginAs(ctx, user.token);
  const page = await ctx.newPage();
  await page.goto(`/q/${q.id}`);
  await page.keyboard.press('Tab');
  await expect(page.getByText('تخطَّ إلى المحتوى')).toBeFocused();
  // reach the first option radio, choose it, then submit with the keyboard
  const firstRadio = page.locator(`input[name="opt-${q.id}"]`).first();
  await firstRadio.focus();
  await page.keyboard.press('Space');
  await expect(firstRadio).toBeChecked();
  await page.getByRole('button', { name: 'سجّل توقعي' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/توقعك:/)).toBeVisible();
});
