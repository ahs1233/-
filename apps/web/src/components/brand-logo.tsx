/**
 * شعار السوگ — رمز مجنّح بنكهة آشورية/سومرية (برونزي ذهبي).
 * SVG مرسوم لا يعتمد على صورة خارجية.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c99a6a" />
          <stop offset="1" stopColor="#9a6638" />
        </linearGradient>
      </defs>
      <g fill="url(#bm)">
        {/* القرص المركزي */}
        <circle cx="32" cy="30" r="8" />
        <circle cx="32" cy="30" r="3.2" fill="#f7f4ee" />
        {/* الجناحان (طبقات الريش) */}
        <path d="M30 28 L10 22 q-3 1 -2 4 L28 31 Z" />
        <path d="M30 31 L13 28 q-3 1 -2 4 L28 33.5 Z" />
        <path d="M30 34 L16 33 q-3 1 -2 4 L29 36 Z" />
        <path d="M34 28 L54 22 q3 1 2 4 L36 31 Z" />
        <path d="M34 31 L51 28 q3 1 2 4 L36 33.5 Z" />
        <path d="M34 34 L48 33 q3 1 2 4 L35 36 Z" />
        {/* الذيل */}
        <path d="M29 38 h6 l-1 8 h-4 Z" />
        <path d="M27 39 l-2 7 h3 Z M37 39 l2 7 h-3 Z" />
      </g>
    </svg>
  );
}
