# NestJS API (REST + Socket.IO + BullMQ workers). Vendor-neutral: any OCI runtime.
# The base image is the official Playwright image: it ships Node and a pinned Chromium, which
# renders share cards with correct Arabic shaping. No OS package downloads are needed at build time.
ARG BASE_IMAGE=mcr.microsoft.com/playwright:v1.63.0-noble
FROM ${BASE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Optional: behind a TLS-intercepting proxy, pass the CA with --secret id=ca,src=ca.crt (and HTTPS_PROXY build arg).
RUN --mount=type=secret,id=ca,required=false NODE_EXTRA_CA_CERTS=/run/secrets/ca sh -c "corepack enable && corepack prepare pnpm@10.28.0 --activate"
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY e2e/package.json e2e/
RUN --mount=type=secret,id=ca,required=false NODE_EXTRA_CA_CERTS=/run/secrets/ca pnpm install --frozen-lockfile --filter @app/api... --filter @app/db...
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @app/shared build && pnpm --filter @app/db build && pnpm --filter @app/api build

# One-shot job: apply migrations (and seed when SEED=true, local only).
FROM build AS migrate
CMD ["sh", "-c", "cd packages/db && pnpm exec prisma migrate deploy && if [ \"$SEED\" = \"true\" ]; then pnpm exec tsx prisma/seed.ts; fi"]

FROM build AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000
USER pwuser
CMD ["node", "dist/main.js"]
