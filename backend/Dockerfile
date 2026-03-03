FROM node:20-bookworm

WORKDIR /app

# Prisma schema must exist
COPY prisma ./prisma/

COPY package*.json ./

# Install deps WITHOUT Prisma running
RUN npm install --no-audit --no-fund

# Copy rest of the code
COPY . .

# Generate Prisma INSIDE Docker (Linux)
RUN npx prisma generate

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]