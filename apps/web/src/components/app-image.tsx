import NextImage from "next/image";

/**
 * صورة موحّدة لكل التطبيق:
 * - صور التخزين الكائني (مضيف NEXT_PUBLIC_IMAGE_HOST) → next/image بتحسين كامل
 *   (srcset/WebP/lazy).
 * - data URLs والمسارات المحلية وروابط أخرى → <img> كسولة (لا يدعمها المحسِّن
 *   أو لا فائدة من تحسينها).
 */
const IMAGE_HOST = process.env.NEXT_PUBLIC_IMAGE_HOST;

function isOptimizable(src: string): boolean {
  if (!IMAGE_HOST || !src.startsWith("https://")) return false;
  try {
    return new URL(src).hostname === IMAGE_HOST;
  } catch {
    return false;
  }
}

export function AppImage({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, 25vw",
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  if (isOptimizable(src)) {
    return <NextImage src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
