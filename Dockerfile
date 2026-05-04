# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

RUN npm run generate
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production deps + prisma CLI (needed for migrate deploy)
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]
