FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DIRECT_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate
RUN npm run build
RUN ls -la dist/

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3000

CMD ["node", "dist/main"]
