FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Forcer Prisma à générer le client pour l’arch du conteneur
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_ENGINES_DIR=/app/prisma-engines
ENV PRISMA_QUERY_ENGINE_BINARY=/app/prisma-engines/query-engine
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

RUN npx prisma generate --binary-targets native

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/server.js"]