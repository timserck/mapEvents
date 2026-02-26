FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# 1️⃣ Copy only dependency manifests first (better cache)
COPY package*.json ./

# 2️⃣ Harden npm against flaky networks
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set ipv6 false \
 && npm config set fund false \
 && npm config set audit false \
 && npm install

# 3️⃣ Prisma schema must exist before generate
COPY prisma ./prisma
RUN npx prisma generate

# 4️⃣ Copy the rest of the source
COPY . .

# 5️⃣ Build TypeScript
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]