import { riyadhTime } from './time';

/** Recurring question templates. They only produce DRAFT payloads; publishing still needs the checklist and a reviewer. */
export type TemplateKey = 'TASI_DAILY_CLOSE' | 'BRENT_DAILY_SETTLE' | 'RIYADH_WEATHER_TOMORROW' | 'SPL_MATCH';

export interface QuestionDraft {
  templateKey: TemplateKey;
  categorySlug: string;
  textAr: string;
  textEn: string;
  options: { labelAr: string; labelEn: string }[];
  lockAt: Date;
  resolveBy: Date;
  sourceName: string;
  sourceUrl: string;
}

export interface TemplateParam {
  name: string;
  type: 'day' | 'number' | 'text' | 'datetime';
  labelAr: string;
  labelEn: string;
}

export interface TemplateDef {
  key: TemplateKey;
  nameAr: string;
  nameEn: string;
  params: TemplateParam[];
}

const DAY: TemplateParam = { name: 'day', type: 'day', labelAr: 'اليوم', labelEn: 'Day' };

export const TEMPLATES: TemplateDef[] = [
  { key: 'TASI_DAILY_CLOSE', nameAr: 'إغلاق تاسي اليومي', nameEn: 'Daily TASI close', params: [DAY] },
  {
    key: 'BRENT_DAILY_SETTLE',
    nameAr: 'تسوية برنت اليومية',
    nameEn: 'Daily Brent settle',
    params: [DAY, { name: 'threshold', type: 'number', labelAr: 'السعر المرجعي (دولار)', labelEn: 'Reference price (USD)' }],
  },
  {
    key: 'RIYADH_WEATHER_TOMORROW',
    nameAr: 'طقس الرياض غداً',
    nameEn: 'Riyadh weather tomorrow',
    params: [{ ...DAY, labelAr: 'اليوم المستهدف (غداً)', labelEn: 'Target day (tomorrow)' }, { name: 'threshold', type: 'number', labelAr: 'درجة الحرارة العظمى (°C)', labelEn: 'Max temperature (°C)' }],
  },
  {
    key: 'SPL_MATCH',
    nameAr: 'مباراة دوري روشن',
    nameEn: 'Saudi Pro League match',
    params: [
      { name: 'homeAr', type: 'text', labelAr: 'الفريق المضيف (عربي)', labelEn: 'Home team (Arabic)' },
      { name: 'homeEn', type: 'text', labelAr: 'الفريق المضيف (إنجليزي)', labelEn: 'Home team (English)' },
      { name: 'awayAr', type: 'text', labelAr: 'الفريق الضيف (عربي)', labelEn: 'Away team (Arabic)' },
      { name: 'awayEn', type: 'text', labelAr: 'الفريق الضيف (إنجليزي)', labelEn: 'Away team (English)' },
      { name: 'kickoff', type: 'datetime', labelAr: 'موعد الانطلاق', labelEn: 'Kick-off' },
    ],
  },
];

const YES_NO = [
  { labelAr: 'نعم', labelEn: 'Yes' },
  { labelAr: 'لا', labelEn: 'No' },
];

export function buildFromTemplate(key: TemplateKey, p: Record<string, string>): QuestionDraft {
  switch (key) {
    case 'TASI_DAILY_CLOSE': {
      const day = p.day!;
      return {
        templateKey: key,
        categorySlug: 'tadawul',
        textAr: `هل سيغلق مؤشر تاسي يوم ${day} على ارتفاع مقارنة بإغلاق الجلسة السابقة؟`,
        textEn: `Will TASI close higher on ${day} than the previous session's close?`,
        options: YES_NO,
        lockAt: riyadhTime(day, 10, 0), // market open
        resolveBy: riyadhTime(day, 16, 0),
        sourceName: 'Saudi Exchange (Tadawul)',
        sourceUrl: 'https://www.saudiexchange.sa/',
      };
    }
    case 'BRENT_DAILY_SETTLE': {
      const day = p.day!;
      const t = Number(p.threshold);
      return {
        templateKey: key,
        categorySlug: 'oil',
        textAr: `هل ستكون تسوية خام برنت يوم ${day} أعلى من ${t} دولار للبرميل؟`,
        textEn: `Will Brent crude settle above ${t} USD per barrel on ${day}?`,
        options: YES_NO,
        lockAt: riyadhTime(day, 12, 0),
        resolveBy: riyadhTime(day, 23, 30),
        sourceName: 'ICE Futures Europe',
        sourceUrl: 'https://www.ice.com/products/219/Brent-Crude-Futures/data',
      };
    }
    case 'RIYADH_WEATHER_TOMORROW': {
      const day = p.day!;
      const t = Number(p.threshold);
      return {
        templateKey: key,
        categorySlug: 'weather',
        textAr: `هل ستتجاوز درجة الحرارة العظمى في الرياض ${t} درجة مئوية يوم ${day}؟`,
        textEn: `Will Riyadh's maximum temperature exceed ${t}°C on ${day}?`,
        options: YES_NO,
        lockAt: riyadhTime(day, 6, 0),
        resolveBy: riyadhTime(day, 22, 0),
        sourceName: 'National Center for Meteorology',
        sourceUrl: 'https://ncm.gov.sa/',
      };
    }
    case 'SPL_MATCH': {
      const kickoff = new Date(p.kickoff!);
      return {
        templateKey: key,
        categorySlug: 'spl',
        textAr: `ما نتيجة مباراة ${p.homeAr} و${p.awayAr} في دوري روشن السعودي؟`,
        textEn: `What will be the result of ${p.homeEn} vs ${p.awayEn} in the Saudi Pro League?`,
        options: [
          { labelAr: `فوز ${p.homeAr}`, labelEn: `${p.homeEn} win` },
          { labelAr: 'تعادل', labelEn: 'Draw' },
          { labelAr: `فوز ${p.awayAr}`, labelEn: `${p.awayEn} win` },
        ],
        lockAt: kickoff,
        resolveBy: new Date(kickoff.getTime() + 3 * 3600_000),
        sourceName: 'Saudi Pro League',
        sourceUrl: 'https://www.spl.com.sa/',
      };
    }
  }
}
