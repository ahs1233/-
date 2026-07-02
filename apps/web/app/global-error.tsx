"use client";

/**
 * حدّ الأخطاء الجذري: يلتقط أعطال الـ layout نفسه.
 * يرسم <html> كاملاً لأنه يحلّ محلّ الجذر (بلا اعتماد على Tailwind/الخط).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "Tajawal, Tahoma, sans-serif",
          background: "#f7f4ee",
          color: "#1a1813",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>حدث خطأ غير متوقّع</h1>
        <p style={{ fontSize: 14, color: "#736b5e", maxWidth: 340, margin: 0 }}>
          نعتذر عن الإزعاج. جرّب إعادة المحاولة أو تحديث الصفحة.
        </p>
        <button
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 12,
            background: "#0c8a8a",
            color: "#fff",
            padding: "10px 22px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
        {error.digest && <p style={{ fontSize: 11, color: "#9c9384" }}>رمز الخطأ: {error.digest}</p>}
      </body>
    </html>
  );
}
