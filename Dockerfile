FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/spec-sdk/package.json packages/spec-sdk/
COPY packages/spec-server/package.json packages/spec-server/
COPY packages/spec-client/package.json packages/spec-client/
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/spec-sdk/node_modules ./packages/spec-sdk/node_modules
COPY --from=deps /app/packages/spec-server/node_modules ./packages/spec-server/node_modules
COPY --from=deps /app/packages/spec-client/node_modules ./packages/spec-client/node_modules
COPY . .
RUN pnpm generate && pnpm build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=build /app/packages/spec-server/dist ./packages/spec-server/dist
COPY --from=build /app/packages/spec-server/package.json ./packages/spec-server/
COPY --from=build /app/packages/spec-sdk/dist ./packages/spec-sdk/dist
COPY --from=build /app/packages/spec-sdk/package.json ./packages/spec-sdk/
COPY --from=build /app/packages/spec-client/dist ./packages/spec-client/dist
COPY --from=build /app/packages/spec-client/package.json ./packages/spec-client/
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/.npmrc ./
RUN pnpm install --frozen-lockfile --prod
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "packages/spec-server/dist/index.js"]
