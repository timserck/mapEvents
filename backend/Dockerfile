FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Registry miroir (clé du succès)
RUN npm config set registry https://registry.npmmirror.com \
 && npm config set fund false \
 && npm config set audit false

COPY package.json package-lock.json ./

RUN npm ci --no-progress

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]