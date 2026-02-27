FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# Toolchain requise pour les deps natives (node-pre-gyp, bcrypt, etc.)
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Dépendances (cache Docker efficace)
COPY package.json package-lock.json ./

RUN npm ci \
  --no-progress \
  --no-audit \
  --no-fund \
  --fetch-retries=10 \
  --fetch-retry-mintimeout=20000 \
  --fetch-retry-maxtimeout=120000

# Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Code
COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]