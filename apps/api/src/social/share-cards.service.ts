/// <reference lib="dom" />
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Browser } from 'playwright-core';
import { PLATFORM_NAME_AR, PLATFORM_NAME_EN } from '@app/shared';
import { loadConfig } from '../config';
import { PrismaService } from '../common/prisma.service';
import { QueueService, QUEUES } from '../jobs/queue.service';

export type ShareKind = 'DUEL_WIN' | 'BEAT_THE_CROWD';

export interface CardData {
  nickname: string;
  headlineAr: string;
  headlineEn: string;
  detailAr: string;
  detailEn: string;
}

/** Finds a Chromium executable: CHROMIUM_PATH, the Playwright cache, or common system paths. */
export function findChromium(): string | undefined {
  const env = loadConfig().CHROMIUM_PATH;
  if (env && existsSync(env)) return env;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(root)) {
    for (const d of readdirSync(root).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = join(root, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  return ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => existsSync(p));
}

function fontFace(): string {
  const pkg = dirname(require.resolve('@fontsource/ibm-plex-sans-arabic/package.json'));
  const face = (subset: string, weight: number) => {
    const b64 = readFileSync(join(pkg, 'files', `ibm-plex-sans-arabic-${subset}-${weight}-normal.woff2`)).toString('base64');
    return `@font-face{font-family:'Plex';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  };
  return ['arabic', 'latin'].flatMap((s) => [face(s, 400), face(s, 700)]).join('\n');
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Server-side share images. Rendered by headless Chromium (HarfBuzz text shaping) because
 * SVG/canvas libraries such as satori do not join Arabic letters correctly.
 */
@Injectable()
export class ShareCardsService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('ShareCards');
  private browser: Promise<Browser> | null = null;
  private fonts: string | null = null;

  constructor(private prisma: PrismaService, private queues: QueueService) {}

  onModuleInit() {
    this.queues.register(QUEUES.share, 'render', (d: { userId: string; kind: ShareKind; refId: string; data: CardData }) => this.generate(d.userId, d.kind, d.refId, d.data), 2);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const { chromium } = await import('playwright-core');
      this.browser = chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox', '--font-render-hinting=none'] });
    }
    return this.browser;
  }

  html(d: CardData): string {
    this.fonts ??= fontFace();
    return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${this.fonts}
      *{margin:0;box-sizing:border-box}
      body{width:1200px;height:630px;font-family:'Plex';background:linear-gradient(135deg,#064e3b,#047857);color:#fff;padding:64px;display:flex;flex-direction:column;justify-content:space-between}
      .brand{font-size:40px;font-weight:700;opacity:.9}
      .head{font-size:72px;font-weight:700;line-height:1.2}
      .en{direction:ltr;text-align:left;font-size:34px;opacity:.9;margin-top:8px}
      .detail{font-size:36px;line-height:1.4;margin-top:24px}
      .nick{font-size:44px;font-weight:700;background:rgba(255,255,255,.15);padding:8px 24px;border-radius:999px;display:inline-block}
      .row{display:flex;justify-content:space-between;align-items:center}
    </style></head><body>
      <div class="row"><div class="brand">${esc(PLATFORM_NAME_AR)} · ${esc(PLATFORM_NAME_EN)}</div><div class="nick"><bdi>${esc(d.nickname)}</bdi></div></div>
      <div><div class="head" id="headline">${esc(d.headlineAr)}</div><div class="en">${esc(d.headlineEn)}</div>
      <div class="detail">${esc(d.detailAr)}</div><div class="en">${esc(d.detailEn)}</div></div>
      <div class="en" style="font-size:26px">Free forecasting · no money, no prizes — مجاني بالكامل</div>
    </body></html>`;
  }

  async render(d: CardData): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    try {
      await page.setContent(this.html(d), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      return await page.screenshot({ type: 'png' });
    } finally {
      await page.close();
    }
  }

  /**
   * Proves Arabic shaping in the renderer: joined text ("سلام") must render with a different width
   * than the same letters forced into isolated forms with ZWNJ, using the embedded Arabic font.
   */
  async shapingCheck(): Promise<{ fontLoaded: boolean; joinedWidth: number; isolatedWidth: number }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(this.html({ nickname: 'x', headlineAr: 'سلام', headlineEn: '', detailAr: '', detailEn: '' }));
      return await page.evaluate(async () => {
        await document.fonts.ready;
        const span = (t: string) => {
          const s = document.createElement('span');
          s.style.cssText = "position:absolute;display:inline-block;font-family:'Plex';font-size:64px;white-space:nowrap";
          s.textContent = t;
          document.body.appendChild(s);
          return s.getBoundingClientRect().width;
        };
        return { fontLoaded: document.fonts.check("64px 'Plex'", 'سلام'), joinedWidth: span('سلام'), isolatedWidth: span('س‌ل‌ا‌م') };
      });
    } finally {
      await page.close();
    }
  }

  async generate(userId: string, kind: ShareKind, refId: string, data: CardData) {
    const image = new Uint8Array(await this.render(data));
    const card = await this.prisma.shareCard.upsert({
      where: { userId_kind_refId: { userId, kind, refId } },
      update: { image },
      create: { userId, kind, refId, image },
      select: { id: true },
    });
    this.log.log(`card ${kind} for ${userId}`);
    return card;
  }

  enqueue(userId: string, kind: ShareKind, refId: string, data: CardData) {
    return this.queues.add(QUEUES.share, 'render', { userId, kind, refId, data });
  }

  async onModuleDestroy() {
    if (this.browser) await (await this.browser).close().catch(() => undefined);
  }
}
