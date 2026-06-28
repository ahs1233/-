/**
 * توكنات JWT — access قصير العمر للمصادقة على الطلبات،
 * يعمل على الويب (Authorization header / cookie) وعلى تطبيق native لاحقاً.
 * نستخدم jose (متوافق مع Edge runtime في Next.js middleware).
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { authEnv } from "./env";

export type AppRole = "CUSTOMER" | "VENDOR" | "ADMIN";

export interface AccessClaims {
  sub: string; // userId
  role: AppRole;
  phone: string;
}

const enc = new TextEncoder();

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, phone: claims.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${authEnv.accessTtl}s`)
    .sign(enc.encode(authEnv.accessSecret));
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(authEnv.accessSecret));
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub,
      role: payload.role as AppRole,
      phone: (payload.phone as string) ?? "",
    };
  } catch {
    return null;
  }
}

export type { JWTPayload };
