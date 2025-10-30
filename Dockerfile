# syntax=docker/dockerfile:1
FROM node:20-slim

# Enable pnpm via corepack (installed with Node 20+)
RUN corepack enable

# Create working directory
WORKDIR /app

# Copy entire repo
COPY . .

# --- Build workspace dependencies ---
# Build the TypeScript SDK that examples depend on
RUN pnpm -C typescript install --frozen-lockfile && pnpm -C typescript build

# Build the example packages
RUN pnpm -C examples/typescript install --frozen-lockfile && pnpm -C examples/typescript build

# --- Facilitator setup ---
WORKDIR /app/examples/typescript/facilitator

# Install facilitator dependencies
RUN pnpm install --frozen-lockfile

# Expose the app port (Railway injects $PORT)
EXPOSE 3002

# Environment (Railway automatically provides PORT)
ENV NODE_ENV=production

# Start the facilitator server
CMD ["node", "dist/index.js"]
