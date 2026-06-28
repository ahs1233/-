/**
 * طبقة تخزين مجرّدة لرفع الصور (متوافقة مع S3: MinIO / R2 / S3).
 * تستخدم روابط موقّعة مسبقاً (presigned PUT) بحيث يرفع العميل الملف مباشرةً
 * إلى التخزين دون مروره بالخادم. مجرّدة خلف واجهة لتسهيل تبديل المزوّد.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export interface PresignResult {
  uploadUrl: string; // رابط PUT موقّع
  publicUrl: string; // الرابط العام للملف بعد الرفع
  key: string;
}

export interface StorageProvider {
  readonly configured: boolean;
  presignUpload(opts: { prefix: string; contentType: string }): Promise<PresignResult>;
}

const env = {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  bucket: process.env.S3_BUCKET,
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  publicUrl: process.env.S3_PUBLIC_URL,
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

class S3StorageProvider implements StorageProvider {
  readonly configured: boolean;
  private client?: S3Client;

  constructor() {
    this.configured = Boolean(env.endpoint && env.bucket && env.accessKey && env.secretKey);
    if (this.configured) {
      this.client = new S3Client({
        endpoint: env.endpoint,
        region: env.region,
        credentials: { accessKeyId: env.accessKey!, secretAccessKey: env.secretKey! },
        forcePathStyle: true, // مطلوب لـ MinIO
      });
    }
  }

  async presignUpload({ prefix, contentType }: { prefix: string; contentType: string }): Promise<PresignResult> {
    if (!this.client) throw new Error("التخزين غير مهيّأ (S3_* مفقودة)");
    if (!ALLOWED_TYPES.has(contentType)) throw new Error("نوع ملف غير مدعوم");
    const key = `${prefix}/${randomUUID()}.${EXT[contentType]}`;
    const command = new PutObjectCommand({ Bucket: env.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const base = env.publicUrl ?? `${env.endpoint}/${env.bucket}`;
    return { uploadUrl, publicUrl: `${base}/${key}`, key };
  }
}

let cached: StorageProvider | null = null;
export function getStorage(): StorageProvider {
  if (!cached) cached = new S3StorageProvider();
  return cached;
}

export { ALLOWED_TYPES };
