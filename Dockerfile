FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build --if-present

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app ./

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "server.js"]