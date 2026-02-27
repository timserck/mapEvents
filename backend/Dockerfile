FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# Toolchain pour deps natives
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --no-progress --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]