FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# npm stable (réseau)
RUN npm config set registry https://registry.npmmirror.com \
 && npm config set fund false \
 && npm config set audit false

COPY package.json package-lock.json ./
RUN npm ci --no-progress

# 🔑 Prisma a besoin de ces vars AU BUILD
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

COPY backend/prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]