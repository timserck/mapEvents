# Use Node 20 on Debian Bookworm (multi-arch, better for Raspberry Pi)
FROM node:20-bookworm-slim

# Lower memory usage for install and build
ENV npm_config_jobs=1 \
    npm_config_loglevel=warn \
    npm_config_progress=false \
    NODE_OPTIONS=--max-old-space-size=512

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (no lockfile present)
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve to serve production build
RUN npm install -g serve

# Expose port and run the app
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
