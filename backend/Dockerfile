FROM node:20-bookworm

# Reduce memory pressure during npm install on low-RAM devices
ENV npm_config_jobs=1 \
    npm_config_loglevel=warn \
    npm_config_progress=false

WORKDIR /app

COPY package*.json ./
# Install build deps for native modules like bcrypt on ARM
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential g++ make \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
