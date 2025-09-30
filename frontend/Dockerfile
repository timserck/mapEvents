# Use Node 18 for compatibility
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Install serve to serve production build
RUN npm install -g serve

# Expose port and run the app
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
