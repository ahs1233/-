# صورة إنتاج لتطبيق الويب (Next.js standalone) ضمن monorepo pnpm.
# البناء: docker build -t al-souq-web .
# التشغيل: docker run -p 3000:3000 --env-file .env al-souq-web

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ── التبعيات ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

# ── البناء ──
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app ./
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @al-souq/web build

# ── التشغيل ──
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

# مخرجات standalone تتضمّن node_modules اللازمة فقط
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# عميل Prisma ومحرّكه
COPY --from=builder /app/node_modules/.pnpm/@prisma+client* ./node_modules/.pnpm/
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
