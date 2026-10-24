# Uses the bundled Dockerfile frontend; no external syntax features are needed.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY backend/package.json ./backend/package.json
COPY database/package.json ./database/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter=@oficina/backend...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/database/node_modules ./database/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY . .
RUN pnpm --filter=@oficina/contracts build
RUN pnpm --filter=@oficina/database build
RUN pnpm --filter=@oficina/backend build

# pnpm's node_modules are symlinks (relative, resolved within this Linux build
# context) — @oficina/contracts resolves straight into packages/contracts/,
# and package symlinks resolve into the root node_modules/.pnpm store. The
# runtime stage must keep the SAME relative layout for those links to work;
# copying only backend/node_modules (without the root store + contracts
# package it points at) produces a container that crashes on boot with
# "Cannot find module" for every transitive dependency.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/database/dist ./database/dist
COPY --from=build /app/database/node_modules ./database/node_modules
COPY --from=build /app/database/package.json ./database/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
