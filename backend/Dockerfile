FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Skip prisma generate in Docker, we already generated it on host
# RUN npx prisma generate

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]