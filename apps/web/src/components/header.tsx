import Link from "next/link";
import { ar } from "@al-souq/i18n";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="container-app flex h-14 items-center gap-3">
        <Link href="/" className="text-xl font-bold text-brand-600">
          {ar.common.appName}
        </Link>
        <form action="/search" className="flex-1">
          <input
            name="q"
            type="search"
            placeholder={ar.common.search}
            className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
          />
        </form>
        <Link href="/account" className="text-sm text-neutral-600 hover:text-brand-600">
          {ar.nav.account}
        </Link>
      </div>
    </header>
  );
}
