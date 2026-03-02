FROM node:20-bookworm

WORKDIR /app

# 1️⃣ Dépendances
COPY package*.json ./
RUN npm install --no-audit --no-fund

# 2️⃣ Prisma schema en premier (important pour cache + generate)
COPY prisma ./prisma

# 3️⃣ Génération Prisma DANS Docker (linux-arm)
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN npx prisma generate

# 4️⃣ Code source
COPY . .

# 5️⃣ Build TypeScript
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]