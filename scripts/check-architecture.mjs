#!/usr/bin/env node
/**
 * حارس المعمارية (Architecture Guard) — المرحلة A · PR4.
 * يفرض آلياً الحواف الممنوعة بين السياقات المحدودة (Bounded Contexts) — أبرزها
 * ثابت #9: **Commerce لا يستورد Discovery إطلاقاً**. السياقات اليوم حدود مجلّدات
 * (لا حزم منفصلة بعد)، لذا نرصد الاستيراد النسبي المباشر بين الملفات المتجاورة —
 * وهو حيث يتسرّب الاقتران فعلاً في حزمة واحدة. البرميل المشترك (@al-souq/domain)
 * مستثنى عمداً: هو النواة المشتركة، والاقتران المُراد منعه هو الوصول المباشر لوحدات
 * سياقٍ آخر.
 *
 * التشغيل: `node scripts/check-architecture.mjs` (يفشل بخروج 1 عند أي مخالفة).
 * يشغّل أولاً اختباراً ذاتياً (يزرع مخالفة ويتأكد من رصدها) كي لا يصدأ الحارس صامتاً.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** خريطة السياقات: اسم → أنماط مسار (نسبةً لجذر المستودع، بفواصل «/»). */
const CONTEXTS = [
  {
    name: "discovery",
    patterns: [
      /^packages\/domain\/src\/discovery\//,
      /^packages\/api\/src\/services\/discovery\.ts$/,
      /^packages\/api\/src\/routers\/discovery\.ts$/,
    ],
  },
  {
    name: "commerce",
    patterns: [
      /^packages\/domain\/src\/(order-state|order-number|stock|commission)\.ts$/,
      /^packages\/api\/src\/services\/(order|coupon)\.ts$/,
      /^packages\/api\/src\/routers\/order\.ts$/,
    ],
  },
];

/** الحواف الممنوعة: لا يجوز لملفٍ في `from` أن يستورد (نسبياً) ملفاً في `to`. */
const FORBIDDEN = [
  { from: "commerce", to: "discovery", reason: "ثابت #9: Commerce لا يعتمد Discovery — Discovery يستهلك حقائق الكتالوج، لا العكس" },
  { from: "discovery", to: "commerce", reason: "طبقية: Discovery نواة أعلى — لا يعتمد تفاصيل الطلب/العمولة/المخزون" },
];

const SOURCE_RE = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", ".git"]);

/** يجمع كل ملفات المصدر (عدا الاختبارات والوحدات المولّدة) نسبةً للجذر. */
function collectSources(dir = ROOT, acc = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(ROOT, abs);
    if (SKIP_DIRS.has(entry)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) collectSources(abs, acc);
    else if (SOURCE_RE.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) acc.push(rel.split("\\").join("/"));
  }
  return acc;
}

function contextOf(relPath, contexts = CONTEXTS) {
  for (const c of contexts) if (c.patterns.some((p) => p.test(relPath))) return c.name;
  return null;
}

const IMPORT_RE =
  /(?:import|export)[^'"]*?\sfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** يستخرج قائمة المُواصفات (specifiers) من نص مصدر. */
function importsOf(src) {
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** يطبّع مساراً محلولاً إلى مجموعة مفاتيح مرشّحة (بامتداد/فهرس ضمني). */
function candidateKeys(relResolved) {
  const p = relResolved.split("\\").join("/").replace(/\/$/, "");
  return [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`, `${p}/index.tsx`];
}

/**
 * يحلّل الحواف الممنوعة. نقيّ وقابل للاختبار: يأخذ قائمة ملفات ودالة قراءة وخريطة سياقات.
 * يفحص الاستيراد النسبي فقط (`.`/`..`) — البرميل المشترك مستثنى بالتصميم.
 */
export function analyze(files, read, { contexts = CONTEXTS, forbidden = FORBIDDEN } = {}) {
  const fileSet = new Set(files);
  const violations = [];
  for (const file of files) {
    const fromCtx = contextOf(file, contexts);
    if (!fromCtx) continue;
    for (const spec of importsOf(read(file))) {
      if (!spec.startsWith(".")) continue; // نسبي فقط
      const resolvedAbs = resolve(dirname(join(ROOT, file)), spec);
      const resolvedRel = relative(ROOT, resolvedAbs);
      // اعثر على ملف الهدف الفعلي بين مرشّحات الامتداد/الفهرس.
      const targetFile = candidateKeys(resolvedRel).find((k) => fileSet.has(k));
      if (!targetFile) continue;
      const toCtx = contextOf(targetFile, contexts);
      if (!toCtx || toCtx === fromCtx) continue;
      const edge = forbidden.find((e) => e.from === fromCtx && e.to === toCtx);
      if (edge) violations.push({ file, spec, from: fromCtx, to: toCtx, reason: edge.reason });
    }
  }
  return violations;
}

/** اختبار ذاتي: يزرع ملفَي سياقٍ ومخالفةً ويتأكد من رصدها ومن نظافة الحالة السليمة. */
function selfTest() {
  const contexts = [
    { name: "commerce", patterns: [/^x\/commerce\//] },
    { name: "discovery", patterns: [/^x\/discovery\//] },
  ];
  const forbidden = [{ from: "commerce", to: "discovery", reason: "test" }];
  const files = ["x/commerce/order.ts", "x/discovery/rank.ts"];
  const bad = (f) => (f === "x/commerce/order.ts" ? `import { rankItems } from "../discovery/rank";` : "export const x = 1;");
  const good = (f) => (f === "x/commerce/order.ts" ? `import { z } from "@al-souq/domain";` : "export const x = 1;");
  const caught = analyze(files, bad, { contexts, forbidden });
  const clean = analyze(files, good, { contexts, forbidden });
  if (caught.length !== 1) throw new Error(`الاختبار الذاتي فشل: توقّعنا رصد مخالفة واحدة، وجدنا ${caught.length}`);
  if (clean.length !== 0) throw new Error(`الاختبار الذاتي فشل: البرميل المشترك يجب ألا يُرصَد (${clean.length})`);
}

function main() {
  selfTest();
  const files = collectSources();
  const violations = analyze(files, (f) => readFileSync(join(ROOT, f), "utf8"));
  if (violations.length === 0) {
    console.log(`✅ حارس المعمارية: لا مخالفات (فُحص ${files.length} ملف مصدر؛ الاختبار الذاتي ناجح).`);
    return;
  }
  console.error(`❌ حارس المعمارية: ${violations.length} مخالفة للحواف الممنوعة:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    يستورد «${v.spec}» → سياق ${v.to}`);
    console.error(`    ${v.from} ⇏ ${v.to} — ${v.reason}\n`);
  }
  process.exit(1);
}

// شغّل فقط عند الاستدعاء المباشر (لا عند الاستيراد للاختبار).
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
