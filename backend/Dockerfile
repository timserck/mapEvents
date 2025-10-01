FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
# Install build deps for native modules like bcrypt on ARM
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential g++ make \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci --omit=dev

COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
