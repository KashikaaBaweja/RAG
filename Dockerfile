# syntax=docker/dockerfile:1
# Multi-stage production image for `apps/web` (Next.js standalone).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm install --frozen-lockfile
ARG DATABASE_URL=postgresql://rag:rag@127.0.0.1:5432/rag_metadata
ENV DATABASE_URL=$DATABASE_URL
ENV NEXTAUTH_SECRET=build-time-placeholder-at-least-32-characters-long
ENV NEXTAUTH_URL=http://127.0.0.1:3000
RUN pnpm exec turbo build --filter=web

FROM base AS runner
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
WORKDIR /app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
CMD ["node", "apps/web/server.js"]
