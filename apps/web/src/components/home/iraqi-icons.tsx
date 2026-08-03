/**
 * أيقوناتٌ عراقيّة مرسومة يدويّاً — التفاصيل الصغيرة التي تبني الهويّة.
 * دكّانٌ بغداديّ بدل «متجر»، المتنبّي بدل «كتاب»، دهن عود بدل «عطر»…
 * كلّها خطّيّة (currentColor) لتتماشى مع النيليّ/الذهبيّ.
 */
type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** دكّان بغداديّ — واجهةٌ بمظلّةٍ مموّجة وبابٍ مقوّس. */
export function ShopfrontIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5 L5 5 h14 l1 3.5" />
      <path d="M4 8.5 q1.5 2 3 0 q1.5 2 3 0 q1.5 2 3 0 q1.5 2 3 0 q1.5 2 3 0" />
      <path d="M5.5 9.5 V20 H18.5 V9.5" />
      <path d="M10 20 v-5 a2 2 0 0 1 4 0 v5" />
    </svg>
  );
}

/** المتنبّي — أكوام كتبٍ تحت قوس. */
export function MutanabbiIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10 a8 4.5 0 0 1 16 0" />
      <path d="M4 20.5 h16" />
      <path d="M6 20.5 v-6 h4 v6" />
      <path d="M10.5 20.5 v-8 h4 v8" />
      <path d="M14.5 20.5 v-5 h3.2 v5" />
    </svg>
  );
}

/** دهن عود — مِبخرةٌ يتصاعد منها دخان. */
export function OudIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M8 21 h8" />
      <path d="M8.5 21 l-1-6 h9 l-1 6" />
      <path d="M7 15 h10" />
      <path d="M12 11.5 c-1.4 -1.2 1.4 -2.2 0 -4.2" />
      <path d="M14.5 11 c-1 -1 1 -2 0 -3.4" />
    </svg>
  );
}

/** صندوق خضارٍ خشبيّ بشرائح. */
export function VegCrateIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="6.5" r="1.6" />
      <circle cx="13.5" cy="6.2" r="1.9" />
      <path d="M4 9 h16 v11 H4 z" />
      <path d="M8 9 v11 M12 9 v11 M16 9 v11" />
      <path d="M4 14.5 h16" />
    </svg>
  );
}

/** خطّافٌ نحاسيّ قديم — رمز القصابين. */
export function ButcherHookIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 v10" />
      <path d="M8.5 3 h7" />
      <path d="M12 13 a3.5 3.5 0 1 1 -2.6 5.9" />
    </svg>
  );
}

/** دلّةُ قهوةٍ عربيّة — رمز المقاهي. */
export function DallahIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M8 9 h7 l1 10 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 z" />
      <path d="M15 11 l4 -2 -3 4" />
      <path d="M11 9 V4.5 l2 2" />
    </svg>
  );
}

/** لافتةٌ معدنيّةٌ متدلّية — رمز العروض/السوق. */
export function BannerTagIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4 h12 v3 H6 z" />
      <path d="M8 7 v3 M16 7 v3" />
      <path d="M7 10 h10 v6 l-5 4 -5 -4 z" />
      <circle cx="12" cy="14" r="1.4" />
    </svg>
  );
}

/** صحنٌ مغطّى — رمز المطاعم. */
export function TureenIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 15 a8 5 0 0 1 16 0" />
      <path d="M3 15 h18" />
      <path d="M12 7 v3" />
      <circle cx="12" cy="6.2" r="1" />
      <path d="M6 19 h12" />
    </svg>
  );
}

/** هاون وطاسة — رمز الصيدليات التراثيّ. */
export function ApothecaryIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M6 11 h12 l-1.4 6 a3 3 0 0 1 -3 2.4 h-3.2 a3 3 0 0 1 -3 -2.4 z" />
      <path d="M5 11 h14" />
      <path d="M14 11 l3 -5" />
      <path d="M13 5.5 l3.5 1.5" />
    </svg>
  );
}
