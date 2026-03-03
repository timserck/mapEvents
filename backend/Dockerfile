FROM --platform=linux/amd64 node:20-bookworm

WORKDIR /app

# Copy only what is needed for install
COPY package*.json ./
COPY prisma ./prisma/

# Install deps (prisma generate runs here via postinstall)
RUN npm install --no-audit --no-fund

# Copy source AFTER install
COPY . .

# Build TS
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]