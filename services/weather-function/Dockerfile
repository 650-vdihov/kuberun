# Use official Azure Functions Node.js image
FROM mcr.microsoft.com/azure-functions/node:4-node20

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /home/site/wwwroot

# Copy package files
COPY services/weather-function/package*.json ./

# Install all dependencies (needed for build)
RUN pnpm install

# Copy function code
COPY services/weather-function/host.json ./
COPY services/weather-function/tsconfig.json ./tsconfig.json
COPY services/weather-function/src ./src

# Build TypeScript
RUN pnpm build

# Prune dev dependencies after build
RUN pnpm prune --prod

# Expose port
EXPOSE 7071

# Azure Functions runtime will start automatically
# No CMD needed - the base image handles it
