"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import { Button } from "@al-souq/ui";
import { ar } from "@al-souq/i18n";
import { trpc } from "@/src/trpc/react";
import { BrandMark } from "@/src/components/brand-logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const isSeller = next.includes("become-seller");

  const utils = trpc.useUtils();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: (res) => {
      setDevCode(res.devCode);
      setStep("code");
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: async (data) => {
      // حدّث حالة المصادقة المخزّنة قبل الانتقال، وإلا رأت الصفحة التالية المستخدم كغير مسجّل.
      await utils.auth.me.invalidate();
      // توجيه حسب الدور: المتجر إلى لوحته، الأدمن إلى لوحته، والمشتري إلى وجهته.
      const dest = data.user.role === "VENDOR" ? "/vendor" : data.user.role === "ADMIN" ? "/admin" : next;
      router.replace(dest);
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="bg-page container-app flex min-h-screen flex-col items-center justify-center py-8">
      <div className="bg-card w-full max-w-sm rounded-2xl border border-line p-5 text-neutral-100 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-14 w-14" />
          <h1 className="mt-2 text-2xl font-extrabold text-gold-400">{ar.common.appName}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {isSeller ? "لفتح متجرك، سجّل دخولك برقم هاتفك أولاً" : ar.auth.login}
          </p>
        </div>

        {step === "phone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestOtp.mutate({ phone, purpose: "login" });
            }}
            className="mt-4 space-y-3"
          >
            <label className="block text-sm font-medium text-neutral-300">{ar.auth.phoneLabel}</label>
            <input
              dir="ltr"
              inputMode="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={ar.auth.phonePlaceholder}
              className="bg-card2 h-11 w-full rounded-lg border border-line px-3 text-center text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/40"
            />
            <Button type="submit" className="w-full" loading={requestOtp.isPending}>
              {ar.auth.sendCode}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyOtp.mutate({ phone, code });
            }}
            className="mt-4 space-y-3"
          >
            {devCode && (
              <div className="rounded-xl border border-gold-500/40 bg-gold-500/15 p-3 text-center">
                <p className="text-xs text-gold-200/80">رمزك (لا يوجد SMS بعد — عرضٌ تجريبيّ)</p>
                <p className="mt-0.5 text-2xl font-extrabold tracking-[0.3em] text-gold-300 nums">{devCode}</p>
              </div>
            )}
            <label className="block text-sm font-medium text-neutral-300">{ar.auth.codeLabel}</label>
            <input
              dir="ltr"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
              className="bg-card2 h-11 w-full rounded-lg border border-line px-3 text-center text-lg tracking-widest text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/40"
            />
            <Button type="submit" className="w-full" loading={verifyOtp.isPending}>
              {ar.auth.verify}
            </Button>
            <button
              type="button"
              onClick={() => requestOtp.mutate({ phone, purpose: "login" })}
              className="w-full text-sm text-neutral-400 hover:text-gold-400"
            >
              {ar.auth.resend}
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
      </div>

      {!isSeller && (
        <Link
          href="/login?next=/become-seller"
          className="bg-card2 mt-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-gold-500/30 px-4 py-3 text-sm font-medium text-gold-300 transition hover:border-gold-500/50"
        >
          <Store className="h-4 w-4" />
          صاحب متجر؟ افتح متجرك في السوگ
        </Link>
      )}
    </div>
  );
}
