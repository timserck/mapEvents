FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json ./

# Config npm SANS ipv6
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fund false \
 && npm config set audit false

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-progress

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]