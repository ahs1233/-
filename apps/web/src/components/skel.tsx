/** هياكل تحميلٍ داكنة تطابق تخطيط بطاقات المتجر (بدل «جارٍ التحميل…» العامّة). */

export function Skel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-xl bg-card2 ${className ?? ""}`} style={style} aria-hidden />;
}

export function SkelHeader() {
  return (
    <div className="flex items-center gap-3">
      <Skel className="h-9 w-9 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skel className="h-5 w-1/3" />
        <Skel className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function SkelChips() {
  return (
    <div className="flex gap-2">
      {[64, 88, 76, 72].map((w, i) => (
        <Skel key={i} className="h-8 rounded-full" style={{ width: w }} />
      ))}
    </div>
  );
}

export function SkelCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <Skel className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skel className="h-4 w-4/5" />
        <Skel className="h-3 w-2/5" />
        <Skel className="h-5 w-1/3" />
      </div>
    </div>
  );
}

export function SkelGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => <SkelCard key={i} />)}
    </div>
  );
}

export function SkelRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
      <Skel className="h-14 w-14 flex-shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skel className="h-4 w-3/5" />
        <Skel className="h-3 w-2/5" />
      </div>
      <Skel className="h-8 w-16 rounded-xl" />
    </div>
  );
}

export function SkelList({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => <SkelRow key={i} />)}
    </div>
  );
}

export function SkelRail() {
  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skel key={i} className="h-56 w-44 flex-shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}
