# syntax=docker/dockerfile:1

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @task-tracker/api

FROM deps AS build
COPY apps/api ./apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @task-tracker/api

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
