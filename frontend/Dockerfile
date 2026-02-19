# =========================
# Build stage
# =========================
FROM node:20-bookworm-slim AS build

ENV npm_config_jobs=1 \
    npm_config_loglevel=warn \
    npm_config_progress=false \
    NODE_OPTIONS=--max-old-space-size=512

WORKDIR /app

ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build


# =========================
# Runtime stage (SMALL)
# =========================
FROM node:20-alpine

WORKDIR /app

# Install serve only in final image
RUN npm install -g serve

# Copy ONLY the build output
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
