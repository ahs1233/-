import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // اختبارات تكامل تتطلّب قاعدة بيانات — تُشغَّل تسلسلياً لتفادي التداخل
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
