/**
 * خدمة OTP: توليد رمز، تخزين تجزئته، التحقق منه مع حدّ للمحاولات وصلاحية.
 * الرمز لا يُخزَّن كنص صريح إطلاقاً (bcrypt).
 */
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@al-souq/db";
import { authEnv } from "./env";
import { getSmsProvider, otpMessage } from "./sms";

function generateNumericCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export interface RequestOtpResult {
  /** يُعاد فقط في التطوير (SMS_PROVIDER=console) لتسهيل الاختبار. */
  devCode?: string;
  expiresAt: Date;
}

/**
 * يُنشئ رمز OTP جديداً للهاتف، يُبطل الرموز السابقة غير المستهلكة لنفس الغرض،
 * ويرسله عبر مزوّد SMS.
 */
export async function requestOtp(phone: string, purpose = "login"): Promise<RequestOtpResult> {
  const code = generateNumericCode(authEnv.otpLength);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + authEnv.otpTtl * 1000);

  // إبطال أي رموز سابقة فعّالة (منع تكدّس رموز صالحة)
  await prisma.otpCode.updateMany({
    where: { phone, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { phone, purpose, codeHash, expiresAt },
  });

  await getSmsProvider().send({ to: phone, body: otpMessage(code) });

  const isDev = authEnv.smsProvider === "console";
  return { expiresAt, ...(isDev ? { devCode: code } : {}) };
}

export interface VerifyOtpResult {
  ok: boolean;
  reason?: string;
}

/**
 * يتحقق من رمز OTP. يزيد عدّاد المحاولات عند الفشل ويُبطل الرمز عند تجاوز الحد.
 * يُستهلك الرمز عند النجاح (استخدام واحد).
 */
export async function verifyOtp(phone: string, code: string, purpose = "login"): Promise<VerifyOtpResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, reason: "لا يوجد رمز فعّال، اطلب رمزاً جديداً" };
  if (otp.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "انتهت صلاحية الرمز" };
  }
  if (otp.attempts >= authEnv.otpMaxAttempts) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { ok: false, reason: "تجاوزت عدد المحاولات، اطلب رمزاً جديداً" };
  }

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: "الرمز غير صحيح" };
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
