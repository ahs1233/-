#!/bin/bash
# هيّئ بيئة جلسة Claude Code: التبعيات + عميل Prisma
# بحيث تعمل أوامر typecheck / lint / test مباشرةً.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# pnpm عبر corepack
corepack enable >/dev/null 2>&1 || true

echo "[session-start] تثبيت التبعيات…"
pnpm install --prefer-offline || pnpm install

# توليد عميل Prisma (يتطلّب تنزيل المحرّك — لا نُفشل الجلسة إن تعذّر)
echo "[session-start] توليد عميل Prisma…"
pnpm db:generate || echo "[session-start] تحذير: تعذّر توليد Prisma (تابع)"

echo "[session-start] جاهز."
