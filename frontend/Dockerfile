# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY frontend/package.json ./frontend/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter=@oficina/frontend...

FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LEGAL_COMPANY_NAME
ARG NEXT_PUBLIC_LEGAL_COMPANY_DOCUMENT
ARG NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS
ARG NEXT_PUBLIC_PRIVACY_EMAIL
ENV NEXT_PUBLIC_LEGAL_COMPANY_NAME=$NEXT_PUBLIC_LEGAL_COMPANY_NAME
ENV NEXT_PUBLIC_LEGAL_COMPANY_DOCUMENT=$NEXT_PUBLIC_LEGAL_COMPANY_DOCUMENT
ENV NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS=$NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS
ENV NEXT_PUBLIC_PRIVACY_EMAIL=$NEXT_PUBLIC_PRIVACY_EMAIL
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY . .
RUN pnpm --filter=@oficina/contracts build
RUN pnpm --filter=@oficina/frontend build

# pnpm's node_modules are symlinks (relative, resolved within this Linux
# build context) — @oficina/contracts resolves straight into
# packages/contracts/, and package symlinks resolve into the root
# node_modules/.pnpm store. The runtime stage must keep the SAME relative
# layout for those links to work; copying only frontend/node_modules
# (without the root store + contracts package it points at) produces a
# container that crashes on boot with "Cannot find module" for every
# transitive dependency. (output: 'standalone' would avoid this but its file
# tracer needs symlink-creation privileges unavailable on a non-elevated
# Windows dev machine — see next.config.mjs.)
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/node_modules ./frontend/node_modules
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/package.json ./frontend/package.json
COPY --from=build /app/frontend/next.config.mjs ./frontend/next.config.mjs
EXPOSE 3000
# next is a direct dependency of @oficina/frontend only, so pnpm places its
# bin symlink at frontend/node_modules/.bin/next — NOT at the workspace
# root's node_modules/.bin (root .bin only has hoisted/root-level bins like
# turbo). Exec-form CMD does no PATH lookup, so the path must be exact.
CMD ["frontend/node_modules/.bin/next", "start", "frontend"]
