import { prisma } from "@al-souq/db";
import { appRouter, createContext } from "../src";

/** يسجّل الدخول عبر OTP (مزوّد console يعيد devCode) ويعيد مُنادياً مصادقاً. */
export async function login(phone: string) {
  // في الاختبارات نُنظّف رموز OTP السابقة لهذا الهاتف كي لا يتراكم حدّ المعدّل
  // عبر عمليات دخول متعدّدة (حدّ المعدّل نفسه يبقى فعّالاً في الإنتاج).
  await prisma.otpCode.deleteMany({ where: { phone } });
  const anon = appRouter.createCaller(await createContext({ headers: new Headers() }));
  const otp = await anon.auth.requestOtp({ phone, purpose: "login" });
  if (!otp.devCode) throw new Error("devCode مفقود — اضبط SMS_PROVIDER=console");
  const verifyCaller = appRouter.createCaller(
    await createContext({ headers: new Headers(), resHeaders: new Headers() }),
  );
  const v = await verifyCaller.auth.verifyOtp({ phone, code: otp.devCode });
  return appRouter.createCaller(
    await createContext({ headers: new Headers({ authorization: `Bearer ${v.accessToken}` }) }),
  );
}

export async function anonApi() {
  return appRouter.createCaller(await createContext({ headers: new Headers() }));
}

/** هاتف عراقي فريد لكل تشغيل لتفادي تضارب المستخدمين. */
export function uniquePhone(): string {
  return "+9647" + String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}
