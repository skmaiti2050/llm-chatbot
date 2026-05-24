# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install all dependencies for build
COPY package.json package-lock.json ./
RUN npm ci

# Generate prisma client
COPY prisma/ ./prisma/
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build the application
COPY . .
RUN npm run build

# Clean up dev dependencies and regenerate prisma client for production
RUN npm ci --omit=dev && npm cache clean --force
RUN npx prisma generate

# Stage 2: Production
FROM node:24-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 4000

CMD ["sh", "-c", "npx --yes prisma migrate deploy && node dist/src/main.js"]
