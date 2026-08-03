import type { NextRequest } from "next/server";

/**
 * مولّد صورةٍ بديلةٍ مُوحّدة العلامة (SVG داكن + لمسة ذهبيّة + رمزُ الفئة + اسم العنصر).
 * بديلٌ مؤقّتٌ راقٍ ريثما تُرفع صورٌ حقيقيّة — لا أيقونة emoji عامّة، بل بطاقةٌ بهويّة «السوگ».
 * الاستعمال: /api/ph?t=اسم%20المنتج&c=عطور&k=banner
 */

// رمزُ الفئة حسب كلمةٍ مفتاحيّة في اسمها.
const MOTIF: [RegExp, string][] = [
  [/عطر|عطور|عود|مسك|بخور/, "🌸"],
  [/كتب|كتاب|مكتب|قرطاس|مجل/, "📚"],
  [/مطعم|أكل|مشاوي|قوزي|تمن|دولمة|كباب|وجبة|شورب|مقلوبة|كبّة/, "🍽️"],
  [/حلوى|حلويات|بقلاوة|كليجة|كنافة|زلاب|حلقوم/, "🍮"],
  [/هاتف|iphone|آيفون|لاب|سماع|شاحن|إلكترون|ساعة ذكية|باور/, "📱"],
  [/عباية|فستان|أزياء نسائية|حقيبة|كعب|إكسسوار/, "👗"],
  [/دشداشة|قميص|بدلة|حذاء|شنطة|أزياء رجالية|ساعة رجالية|حزام/, "👔"],
  [/بقالة|رز|زيت|سكر|شاي|سلّة|سوبر/, "🛒"],
  [/صحة|صيدل|فيتامين|كمّام|معقّم|ضغط|طبّ/, "💊"],
  [/نحاس|دلّة|صينية|طقم|أواني|منزل|مفروش|سجّاد/, "🏺"],
  [/تمر|مكسر|فستق|لوز|بهار|سمّاق/, "🌰"],
];

function motifFor(c: string, t: string): string {
  const hay = `${c} ${t}`;
  for (const [re, em] of MOTIF) if (re.test(hay)) return em;
  return "🛍️";
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]!);
}

// تقسيمُ الاسم إلى سطرين إن طال.
function wrap(t: string): string[] {
  if (t.length <= 18) return [t];
  const words = t.split(" ");
  const lines: string[] = ["", ""];
  let i = 0;
  for (const w of words) {
    if ((lines[i] + " " + w).trim().length > 18 && i === 0) i = 1;
    lines[i] = (lines[i] + " " + w).trim();
  }
  return lines.filter(Boolean);
}

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const t = (sp.get("t") ?? "السوگ").slice(0, 60);
  const c = sp.get("c") ?? "";
  const kind = sp.get("k") ?? "product";
  const banner = kind === "banner";
  const W = banner ? 1200 : 800;
  const H = banner ? 460 : 800;
  const motif = motifFor(c, t);
  const lines = wrap(t);
  const nameY = H - (banner ? 70 : 96);

  const nameSvg = lines
    .map((ln, i) => `<text x="${W / 2}" y="${nameY + i * (banner ? 46 : 54)}" text-anchor="middle" font-family="'Noto Kufi Arabic','Segoe UI',Tahoma,sans-serif" font-size="${banner ? 38 : 44}" font-weight="800" fill="#f4e7c8" direction="rtl">${esc(ln)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#131a2e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#c99a3a" stop-opacity="0.22"/><stop offset="1" stop-color="#c99a3a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${W / 2}" y="${H / 2 - (banner ? 10 : 40)}" text-anchor="middle" font-size="${banner ? 150 : 220}" opacity="0.9">${motif}</text>
  <text x="${W - 24}" y="46" text-anchor="end" font-family="'Noto Kufi Arabic',sans-serif" font-size="26" font-weight="800" fill="#c99a3a" opacity="0.85" direction="rtl">السوگ</text>
  ${nameSvg}
  <rect x="${W / 2 - 40}" y="${nameY - (banner ? 62 : 78)}" width="80" height="4" rx="2" fill="#c99a3a"/>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
