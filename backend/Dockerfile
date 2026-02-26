FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# 👇 COPY PRISMA SCHEMA BEFORE GENERATE
COPY prisma ./prisma

# 👇 THIS IS THE IMPORTANT LINE
RUN npx prisma generate

# Copy rest of the source
COPY . .

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]