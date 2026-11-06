/**
 * Development seed: 6 categories, staff accounts, 200 fake users, 50 questions in mixed states,
 * forecasts, scores, weekly leagues, duels and friend leagues.
 * Deterministic (fixed PRNG seed) so screenshots and walkthroughs are reproducible.
 * Redis leaderboards are rebuilt by the API on boot; crowd counters rebuild lazily.
 */
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  applyStreakDay,
  CONFIDENCE_LEVELS,
  DAY_MS,
  duelOutcome,
  challengerEloResult,
  ELO_START,
  eloUpdate,
  EMPTY_STREAK,
  forecastScore,
  GROUP_SIZE,
  HOUR_MS,
  rankGroup,
  riyadhDay,
  SAUDI_CITIES,
  seasonWindow,
  StreakState,
  weekStart,
  WEEK_MS,
} from '@app/shared';

const prisma = new PrismaClient();

// ---------- deterministic randomness (seed data only) ----------
let state = 20261106;
function rnd() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pickOne = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const shuffle = <T>(xs: T[]) => xs.map((x) => [rnd(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

// ---------- crypto, mirroring apps/api/src/common/crypto.ts ----------
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required (copy .env.example to .env)`);
  return v;
};
const hashPhone = (e164: string) => createHmac('sha256', env('PHONE_PEPPER')).update(e164).digest('hex');
function encryptPhone(e164: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(env('PHONE_ENC_KEY'), 'hex'), iv);
  const enc = Buffer.concat([c.update(e164, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export const CATEGORIES = [
  { slug: 'spl', nameAr: 'دوري روشن السعودي', nameEn: 'Saudi Pro League' },
  { slug: 'tadawul', nameAr: 'تداول', nameEn: 'Tadawul' },
  { slug: 'oil', nameAr: 'النفط', nameEn: 'Oil' },
  { slug: 'weather', nameAr: 'الطقس', nameEn: 'Weather' },
  { slug: 'events', nameAr: 'فعاليات', nameEn: 'Events' },
  { slug: 'tech', nameAr: 'تقنية', nameEn: 'Tech' },
];

const STAFF = [
  { phone: '+966500000001', nickname: 'editor_sara', role: 'EDITOR' as const },
  { phone: '+966500000002', nickname: 'reviewer_fahad', role: 'REVIEWER' as const },
  { phone: '+966500000003', nickname: 'admin_noura', role: 'ADMIN' as const },
  { phone: '+966500000004', nickname: 'player_one', role: 'USER' as const },
];

const TEAMS: [string, string][] = [
  ['الهلال', 'Al Hilal'],
  ['النصر', 'Al Nassr'],
  ['الاتحاد', 'Al Ittihad'],
  ['الأهلي', 'Al Ahli'],
  ['الشباب', 'Al Shabab'],
  ['الاتفاق', 'Al Ettifaq'],
  ['التعاون', 'Al Taawoun'],
  ['الفتح', 'Al Fateh'],
];
const YES_NO = [
  { labelAr: 'نعم', labelEn: 'Yes' },
  { labelAr: 'لا', labelEn: 'No' },
];
const NAMES = ['falcon', 'najm', 'sahm', 'raed', 'dana', 'reem', 'layan', 'saud', 'hessa', 'turki', 'nouf', 'yazeed', 'jood', 'malak', 'omar', 'lama', 'khalid', 'sara', 'bader', 'ghada', 'majed', 'shahad', 'faisal', 'nora', 'waleed'];

interface QDef {
  cat: string;
  textAr: string;
  textEn: string;
  options: { labelAr: string; labelEn: string }[];
  source: [string, string];
}

function questionBank(i: number): QDef {
  const cat = CATEGORIES[i % 6]!.slug;
  switch (cat) {
    case 'spl': {
      const [h, a] = shuffle([...TEAMS]).slice(0, 2) as [[string, string], [string, string]];
      return {
        cat,
        textAr: `ما نتيجة مباراة ${h[0]} و${a[0]} في دوري روشن السعودي؟`,
        textEn: `What will be the result of ${h[1]} vs ${a[1]} in the Saudi Pro League?`,
        options: [
          { labelAr: `فوز ${h[0]}`, labelEn: `${h[1]} win` },
          { labelAr: 'تعادل', labelEn: 'Draw' },
          { labelAr: `فوز ${a[0]}`, labelEn: `${a[1]} win` },
        ],
        source: ['Saudi Pro League', 'https://www.spl.com.sa/'],
      };
    }
    case 'tadawul': {
      const v = pickOne([5, 6, 7, 8]);
      return pickOne([
        { cat, textAr: 'هل سيغلق مؤشر تاسي اليوم على ارتفاع مقارنة بالجلسة السابقة؟', textEn: "Will TASI close higher today than the previous session's close?", options: YES_NO, source: ['Saudi Exchange (Tadawul)', 'https://www.saudiexchange.sa/'] as [string, string] },
        { cat, textAr: `هل ستتجاوز قيمة التداول في السوق الرئيسية ${v} مليارات ريال اليوم؟`, textEn: `Will main-market traded value exceed SAR ${v} billion today?`, options: YES_NO, source: ['Saudi Exchange (Tadawul)', 'https://www.saudiexchange.sa/'] as [string, string] },
      ]);
    }
    case 'oil': {
      const p = pickOne([72, 74, 76, 78, 80]);
      return { cat, textAr: `هل ستكون تسوية خام برنت اليوم أعلى من ${p} دولاراً للبرميل؟`, textEn: `Will Brent crude settle above ${p} USD per barrel today?`, options: YES_NO, source: ['ICE Futures Europe', 'https://www.ice.com/products/219/Brent-Crude-Futures/data'] };
    }
    case 'weather': {
      const t = pickOne([28, 30, 32, 34]);
      return pickOne([
        { cat, textAr: `هل ستتجاوز درجة الحرارة العظمى في الرياض ${t} درجة مئوية اليوم؟`, textEn: `Will Riyadh's maximum temperature exceed ${t}°C today?`, options: YES_NO, source: ['National Center for Meteorology', 'https://ncm.gov.sa/'] as [string, string] },
        { cat, textAr: 'هل ستسجل أبها هطول أمطار اليوم؟', textEn: 'Will Abha record rainfall today?', options: YES_NO, source: ['National Center for Meteorology', 'https://ncm.gov.sa/'] as [string, string] },
      ]);
    }
    case 'events':
      return pickOne([
        { cat, textAr: 'هل ستُعلن تذاكر حفل نهاية الأسبوع في بوليفارد سيتي نفاد الكمية قبل الساعة 20:00؟', textEn: "Will this weekend's Boulevard City concert be announced sold out before 20:00?", options: YES_NO, source: ['Riyadh Season', 'https://riyadhseason.com/'] as [string, string] },
        { cat, textAr: 'كم عدد الفعاليات الجديدة التي سيعلنها تقويم موسم الرياض اليوم؟', textEn: 'How many new events will the Riyadh Season calendar announce today?', options: [{ labelAr: 'لا شيء', labelEn: 'None' }, { labelAr: '1 إلى 3', labelEn: '1 to 3' }, { labelAr: '4 أو أكثر', labelEn: '4 or more' }], source: ['Riyadh Season', 'https://riyadhseason.com/'] as [string, string] },
      ]);
    default:
      return pickOne([
        { cat, textAr: 'هل سيكون التطبيق الأول في قائمة التطبيقات المجانية في متجر آب ستور السعودي اليوم لعبة؟', textEn: 'Will the top free app on the Saudi App Store today be a game?', options: YES_NO, source: ['Apple App Store (SA)', 'https://apps.apple.com/sa/charts/iphone'] as [string, string] },
        { cat, textAr: 'هل ستعلن شركة سعودية ناشئة عن جولة تمويل تتجاوز 100 مليون دولار اليوم؟', textEn: 'Will a Saudi startup announce a funding round above 100 million USD today?', options: YES_NO, source: ['MAGNiTT', 'https://magnitt.com/news'] as [string, string] },
      ]);
  }
}

async function main() {
  for (const c of CATEGORIES) await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  if (await prisma.user.findUnique({ where: { nickname: 'admin_noura' } })) {
    console.log('seed: data already present, skipping (run `pnpm db:reset && pnpm db:seed` to start over)');
    return;
  }
  const cats = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));
  const now = new Date();
  const consent = (at: Date) => [
    { type: 'AGE_18_PLUS', at: at.toISOString() },
    { type: 'PRIVACY_NOTICE', version: '2026-11', at: at.toISOString() },
  ];

  // ---------- users ----------
  const staff: Record<string, string> = {};
  for (const s of STAFF) {
    const at = new Date(now.getTime() - 60 * DAY_MS);
    const u = await prisma.user.create({
      data: { phoneHash: hashPhone(s.phone), phoneEncrypted: encryptPhone(s.phone), nickname: s.nickname, city: 'riyadh', interests: ['spl', 'tadawul', 'tech'], role: s.role, ageConfirmedAt: at, onboardedAt: at, consentLog: consent(at), createdAt: at },
    });
    staff[s.role === 'USER' ? 'PLAYER' : s.role] = u.id;
  }
  const userIds: string[] = [staff.PLAYER!];
  for (let i = 0; i < 200; i++) {
    const phone = `+9665${String(10000000 + i).padStart(8, '0')}`;
    const at = new Date(now.getTime() - int(5, 50) * DAY_MS);
    const u = await prisma.user.create({
      data: {
        phoneHash: hashPhone(phone),
        phoneEncrypted: encryptPhone(phone),
        nickname: `${pickOne(NAMES)}_${100 + i}`,
        city: pickOne(SAUDI_CITIES),
        interests: shuffle(CATEGORIES.map((c) => c.slug)).slice(0, 3),
        ageConfirmedAt: at,
        onboardedAt: at,
        consentLog: consent(at),
        createdAt: at,
      },
    });
    userIds.push(u.id);
  }

  // ---------- questions in mixed states ----------
  type Plan = { status: 'LIVE' | 'LOCKED' | 'RESOLVED' | 'FINAL' | 'VOID' | 'DRAFT' | 'REVIEW'; lockAt: Date; resolveBy: Date; resolvedAt?: Date };
  const plans: Plan[] = [];
  for (let i = 0; i < 20; i++) {
    const lockAt = new Date(now.getTime() + (1 + i) * HOUR_MS * 0.9);
    plans.push({ status: 'LIVE', lockAt, resolveBy: new Date(lockAt.getTime() + 3 * HOUR_MS) });
  }
  for (let i = 0; i < 5; i++) plans.push({ status: 'LOCKED', lockAt: new Date(now.getTime() - (i + 1) * HOUR_MS), resolveBy: new Date(now.getTime() + 2 * HOUR_MS) });
  for (let i = 0; i < 4; i++) {
    const resolvedAt = new Date(now.getTime() - (i + 1) * 2 * HOUR_MS);
    plans.push({ status: 'RESOLVED', lockAt: new Date(resolvedAt.getTime() - 3 * HOUR_MS), resolveBy: resolvedAt, resolvedAt });
  }
  for (let i = 0; i < 11; i++) {
    const resolvedAt = new Date(now.getTime() - (1 + i) * DAY_MS + int(0, 6) * HOUR_MS);
    plans.push({ status: 'FINAL', lockAt: new Date(resolvedAt.getTime() - 3 * HOUR_MS), resolveBy: resolvedAt, resolvedAt });
  }
  for (let i = 0; i < 3; i++) plans.push({ status: 'VOID', lockAt: new Date(now.getTime() - (i + 2) * DAY_MS), resolveBy: new Date(now.getTime() - (i + 2) * DAY_MS + 3 * HOUR_MS) });
  for (let i = 0; i < 4; i++) plans.push({ status: 'DRAFT', lockAt: new Date(now.getTime() + (6 + i) * HOUR_MS), resolveBy: new Date(now.getTime() + (9 + i) * HOUR_MS) });
  for (let i = 0; i < 3; i++) plans.push({ status: 'REVIEW', lockAt: new Date(now.getTime() + (5 + i) * HOUR_MS), resolveBy: new Date(now.getTime() + (8 + i) * HOUR_MS) });

  const seasons = new Map<string, string>();
  const seasonFor = async (at: Date) => {
    const w = seasonWindow(at, process.env.SEASON_ANCHOR ?? '2026-01-04');
    const key = String(w.index);
    if (!seasons.has(key)) seasons.set(key, (await prisma.season.upsert({ where: { index: w.index }, update: {}, create: { index: w.index, startsAt: w.startsAt, endsAt: w.endsAt } })).id);
    return seasons.get(key)!;
  };

  const streaks = new Map<string, StreakState>();
  const membership = new Map<string, { division: number; points: number; joinedAt: Date }>(); // key userId|week
  const resolvedQs: { id: string; winning: string; options: string[]; status: string }[] = [];
  const liveQs: { id: string; options: string[]; lockAt: Date }[] = [];
  let qCount = 0;

  for (const [i, plan] of plans.entries()) {
    const def = questionBank(i);
    const opts = def.options.map((o, j) => ({ id: `o${j}_${i}`, ...o }));
    const published = !['DRAFT', 'REVIEW'].includes(plan.status);
    const publishedAt = published ? new Date(plan.lockAt.getTime() - int(4, 18) * HOUR_MS) : null;
    const q = await prisma.question.create({
      data: {
        categoryId: cats.get(def.cat)!.id,
        textAr: def.textAr,
        textEn: def.textEn,
        options: opts,
        lockAt: plan.lockAt,
        resolveBy: plan.resolveBy,
        sourceName: def.source[0],
        sourceUrl: def.source[1],
        status: plan.status,
        createdById: staff.EDITOR,
        reviewedById: published ? staff.REVIEWER : null,
        publishedAt,
        voidReason: plan.status === 'VOID' ? pickOne(['POSTPONED', 'ABANDONED', 'SOURCE_UNAVAILABLE_48H', 'AMBIGUOUS'] as const) : null,
        createdAt: new Date((publishedAt ?? now).getTime() - HOUR_MS),
      },
    });
    qCount++;
    await prisma.auditLog.create({ data: { actorId: staff.EDITOR, action: 'question.create', entity: 'Question', entityId: q.id, after: { seeded: true } } });
    if (!published) continue;

    // forecasts (skewed towards the first option so crowds are uneven)
    const forecasters = shuffle(userIds.slice(1)).slice(0, int(25, 120));
    if (plan.status !== 'LIVE' || i % 3 === 0) forecasters.push(staff.PLAYER!); // the demo player has some history
    const counts: Record<string, number> = {};
    const forecasts: { id: string; userId: string; optionId: string; confidence: number }[] = [];
    for (const userId of forecasters) {
      const optionId = rnd() < 0.55 ? opts[0]!.id : pickOne(opts).id;
      const confidence = pickOne(CONFIDENCE_LEVELS);
      const at = new Date(publishedAt!.getTime() + rnd() * Math.max(1, Math.min(plan.lockAt.getTime(), now.getTime()) - publishedAt!.getTime()));
      const f = await prisma.forecast.create({ data: { userId, questionId: q.id, optionId, confidence, createdAt: at, updatedAt: at } });
      await prisma.forecastHistory.create({ data: { forecastId: f.id, userId, questionId: q.id, optionId, confidence, submittedAt: at } });
      counts[optionId] = (counts[optionId] ?? 0) + 1;
      forecasts.push({ id: f.id, userId, optionId, confidence });
      streaks.set(userId, applyStreakDay(streaks.get(userId) ?? EMPTY_STREAK, riyadhDay(at)));
      const wk = `${userId}|${weekStart(at).toISOString()}`;
      if (!membership.has(wk)) membership.set(wk, { division: 1, points: 0, joinedAt: at });
    }
    if (plan.status !== 'LIVE') await prisma.question.update({ where: { id: q.id }, data: { crowdSnapshot: { total: forecasts.length, counts } } });
    else liveQs.push({ id: q.id, options: opts.map((o) => o.id), lockAt: plan.lockAt });

    if (plan.resolvedAt) {
      const winning = (rnd() < 0.6 ? opts[0] : pickOne(opts))!.id;
      await prisma.resolution.create({
        data: { questionId: q.id, winningOptionId: winning, sourceUrl: def.source[1], resolvedById: staff.EDITOR, confirmedById: staff.REVIEWER, resolvedAt: plan.resolvedAt, finalizedAt: plan.status === 'FINAL' ? new Date(plan.resolvedAt.getTime() + 12 * HOUR_MS) : null },
      });
      const seasonId = await seasonFor(plan.resolvedAt);
      const ws = weekStart(plan.resolvedAt);
      for (const f of forecasts) {
        const correct = f.optionId === winning;
        const points = forecastScore(f.confidence, correct, opts.length);
        await prisma.score.create({ data: { forecastId: f.id, userId: f.userId, questionId: q.id, seasonId, categoryId: q.categoryId, weekStart: ws, points, correct, confidence: f.confidence, scoredAt: plan.resolvedAt } });
        const key = `${f.userId}|${ws.toISOString()}`;
        const m = membership.get(key) ?? { division: 1, points: 0, joinedAt: plan.resolvedAt };
        m.points += points;
        membership.set(key, m);
        if (correct && forecasts.length >= 20 && (counts[f.optionId] ?? 0) / forecasts.length < 0.3)
          await prisma.badgeAward.create({ data: { userId: f.userId, badge: 'BEAT_THE_CROWD', awardKey: `BEAT_THE_CROWD:${q.id}`, meta: { questionId: q.id } } });
      }
      resolvedQs.push({ id: q.id, winning, options: opts.map((o) => o.id), status: plan.status });
    }
  }

  // ---------- weekly leagues: fill groups of 30, close past weeks ----------
  const byWeek = new Map<string, { userId: string; points: number; joinedAt: Date }[]>();
  for (const [key, m] of membership) {
    const [userId, wk] = key.split('|') as [string, string];
    byWeek.set(wk, [...(byWeek.get(wk) ?? []), { userId, points: m.points, joinedAt: m.joinedAt }]);
  }
  const currentWeek = weekStart(now).toISOString();
  const lastDivision = new Map<string, number>();
  for (const wk of [...byWeek.keys()].sort()) {
    const ws = new Date(wk);
    const closed = wk < currentWeek;
    const week = await prisma.leagueWeek.create({ data: { weekStart: ws, closedAt: closed ? new Date(ws.getTime() + WEEK_MS) : null } });
    const members = byWeek.get(wk)!.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const byDiv = new Map<number, typeof members>();
    for (const m of members) {
      const d = lastDivision.get(m.userId) ?? 1;
      byDiv.set(d, [...(byDiv.get(d) ?? []), m]);
    }
    for (const [division, list] of byDiv) {
      for (let g = 0; g * GROUP_SIZE < list.length; g++) {
        const slice = list.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE);
        const group = await prisma.leagueGroup.create({ data: { weekId: week.id, weekStart: ws, division, index: g } });
        const ranked = closed ? rankGroup(slice.map((m) => ({ userId: m.userId, weeklyPoints: m.points, joinedAt: m.joinedAt })), division) : null;
        for (const m of slice) {
          const r = ranked?.find((x) => x.userId === m.userId);
          await prisma.leagueMembership.create({ data: { userId: m.userId, weekStart: ws, division, groupId: group.id, weeklyPoints: m.points, joinedAt: m.joinedAt, finalRank: r?.finalRank ?? null, movement: r?.movement ?? null } });
          if (r) lastDivision.set(m.userId, Math.min(5, Math.max(1, division + (r.movement === 'UP' ? 1 : r.movement === 'DOWN' ? -1 : 0))));
        }
      }
    }
  }

  // ---------- streaks ----------
  for (const [userId, s] of streaks)
    await prisma.streak.create({ data: { userId, current: s.current, best: s.best, lastActiveDay: s.lastActiveDay, shieldsUsedThisWeek: s.shieldsUsedThisWeek, shieldWeek: s.shieldWeek } });

  // ---------- duels ----------
  const ratings = new Map<string, { rating: number; played: number; wins: number }>();
  const r = (id: string) => ratings.get(id) ?? { rating: ELO_START, played: 0, wins: 0 };
  let duels = 0;
  for (const rq of resolvedQs.slice(0, 6)) {
    const [a, b] = shuffle(userIds).slice(0, 2) as [string, string];
    const ca = rq.options[0]!;
    const cb = rq.options[1]!;
    const o = duelOutcome([{ winningOptionId: rq.winning, challengerOptionId: ca, opponentOptionId: cb }]);
    if (o.state !== 'DONE') continue;
    const ra = r(a);
    const rb = r(b);
    const e = eloUpdate(ra.rating, rb.rating, challengerEloResult(o));
    const winnerId = o.winner === 'CHALLENGER' ? a : o.winner === 'OPPONENT' ? b : null;
    ratings.set(a, { rating: e.a, played: ra.played + 1, wins: ra.wins + (winnerId === a ? 1 : 0) });
    ratings.set(b, { rating: e.b, played: rb.played + 1, wins: rb.wins + (winnerId === b ? 1 : 0) });
    const created = new Date(now.getTime() - 2 * DAY_MS);
    await prisma.duel.create({
      data: { format: 'SINGLE', challengerId: a, opponentId: b, status: 'DONE', winnerId, challengerEloDelta: e.deltaA, opponentEloDelta: e.deltaB, expiresAt: created, acceptedAt: created, decidedAt: now, weekStart: weekStart(created), createdAt: created, questions: { create: { questionId: rq.id, order: 1, pickedBy: 'CHALLENGER', challengerOptionId: ca, opponentOptionId: cb } } },
    });
    if (winnerId) await prisma.badgeAward.upsert({ where: { userId_awardKey: { userId: winnerId, awardKey: 'DUEL_WIN_1' } }, update: {}, create: { userId: winnerId, badge: 'DUEL_WIN_1', awardKey: 'DUEL_WIN_1' } });
    duels++;
  }
  for (const [userId, v] of ratings) await prisma.duelRating.create({ data: { userId, rating: v.rating, duelsPlayed: v.played, wins: v.wins } });
  // open challenges from the demo player and an active best-of-3
  for (const lq of liveQs.slice(2, 4)) {
    await prisma.duel.create({ data: { format: 'SINGLE', challengerId: staff.PLAYER!, status: 'PENDING', expiresAt: lq.lockAt, weekStart: weekStart(now), questions: { create: { questionId: lq.id, order: 1, pickedBy: 'CHALLENGER', challengerOptionId: lq.options[0] } } } });
    duels++;
  }
  if (liveQs.length >= 8) {
    const [q1, q2, q3] = [liveQs[5]!, liveQs[6]!, liveQs[7]!];
    await prisma.duel.create({
      data: {
        format: 'BEST_OF_3',
        challengerId: userIds[1]!,
        opponentId: staff.PLAYER,
        status: 'ACTIVE',
        acceptedAt: now,
        expiresAt: q1.lockAt,
        weekStart: weekStart(now),
        questions: {
          create: [
            { questionId: q1.id, order: 1, pickedBy: 'CHALLENGER', challengerOptionId: q1.options[0], opponentOptionId: q1.options[1] },
            { questionId: q2.id, order: 2, pickedBy: 'OPPONENT', opponentOptionId: q2.options[0] },
            { questionId: q3.id, order: 3, pickedBy: 'SYSTEM' },
          ],
        },
      },
    });
    duels++;
  }

  // ---------- friend leagues ----------
  const leagues = [
    { name: 'شلة الديوانية', code: 'DIWANIA1', size: 28 },
    { name: 'Office Forecasters', code: 'OFFICE26', size: 15 },
    { name: 'محللو السوق', code: 'TASI2026', size: 9 },
  ];
  for (const l of leagues) {
    const members = [staff.PLAYER!, ...shuffle(userIds.slice(1)).slice(0, l.size - 1)];
    await prisma.friendLeague.create({ data: { name: l.name, inviteCode: l.code, ownerId: members[0]!, members: { create: members.map((userId) => ({ userId })) } } });
  }

  console.log(`seed: ${CATEGORIES.length} categories, ${userIds.length + 3} users (incl. staff), ${qCount} questions, ${await prisma.forecast.count()} forecasts, ${await prisma.score.count()} scores, ${duels} duels, ${leagues.length} friend leagues`);
  console.log('seed: staff logins (OTP is printed in the API log): editor 0500000001, reviewer 0500000002, admin 0500000003, demo player 0500000004');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export type { Prisma };
