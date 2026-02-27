FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# 1️⃣ Copier manifests (package.json + package-lock.json)
COPY package*.json ./

# 2️⃣ Install propre et déterministe
RUN npm ci --no-progress --no-audit --no-fund

# 3️⃣ Prisma
COPY prisma ./prisma
RUN npx prisma generate

# 4️⃣ Code
COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]