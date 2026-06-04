# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm. Pin the major version so the build doesn't depend on whatever
# pnpm the base image/host resolves: pnpm 11 moved onlyBuiltDependencies out of
# package.json and treats ignored build scripts (esbuild) as a hard error under
# --frozen-lockfile. Pinning to 10 keeps the package.json pnpm config working.
RUN npm install -g pnpm@10

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . ./

# Accept build args for Vite environment variables
ARG VITE_ELECTRIC_URL
ARG VITE_ELECTRIC_SECRET

# Export as environment variables for Vite build
ENV VITE_ELECTRIC_URL=${VITE_ELECTRIC_URL}
ENV VITE_ELECTRIC_SECRET=${VITE_ELECTRIC_SECRET}

# Build the React + Vite app
RUN pnpm run build

# Runtime stage - use nginx to serve static files
FROM nginx:alpine

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
