FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# 1️⃣ Copier uniquement les manifests (cache Docker)
COPY package.json ./

# 2️⃣ Config npm + cache BuildKit (IMPORTANT)
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set ipv6 false \
 && npm config set fund false \
 && npm config set audit false

# ⚠️ IMPORTANT : npm ci + cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-progress

# 3️⃣ Prisma
COPY prisma ./prisma
RUN npx prisma generate

# 4️⃣ Code source
COPY . .

# 5️⃣ Build TS
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]