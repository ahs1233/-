"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import { Button, Card, CardBody } from "@al-souq/ui";
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
    onSuccess: () => {
      router.replace(next);
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="container-app flex min-h-screen flex-col items-center justify-center py-8">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-4">
          <div className="flex flex-col items-center text-center">
            <BrandMark className="h-14 w-14" />
            <h1 className="mt-2 text-2xl font-extrabold text-brand-700">
              {ar.common.appName}
              <span className="text-gold-500">.</span>
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{ar.auth.login}</p>
          </div>

          {step === "phone" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestOtp.mutate({ phone, purpose: "login" });
              }}
              className="space-y-3"
            >
              <label className="block text-sm font-medium">{ar.auth.phoneLabel}</label>
              <input
                dir="ltr"
                inputMode="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={ar.auth.phonePlaceholder}
                className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-center outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
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
              className="space-y-3"
            >
              {devCode && (
                <p className="rounded-lg bg-gold-400/20 p-2 text-center text-sm">
                  رمز التطوير: <span className="font-bold nums">{devCode}</span>
                </p>
              )}
              <label className="block text-sm font-medium">{ar.auth.codeLabel}</label>
              <input
                dir="ltr"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
                className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-center text-lg tracking-widest outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
              <Button type="submit" className="w-full" loading={verifyOtp.isPending}>
                {ar.auth.verify}
              </Button>
              <button
                type="button"
                onClick={() => requestOtp.mutate({ phone, purpose: "login" })}
                className="w-full text-sm text-neutral-500 hover:text-brand-600"
              >
                {ar.auth.resend}
              </button>
            </form>
          )}

          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </CardBody>
      </Card>

      <Link
        href="/become-seller"
        className="mt-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm font-medium text-gold-700 transition hover:bg-gold-100"
      >
        <Store className="h-4 w-4" />
        صاحب متجر؟ افتح متجرك في السوگ
      </Link>
    </div>
  );
}
