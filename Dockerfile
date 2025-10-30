# Dockerfile
FROM node:20-slim

# Use pnpm via corepack
RUN corepack enable

WORKDIR /app
COPY . .

# Build monorepo bits the example depends on
RUN cd typescript && pnpm install --frozen-lockfile && pnpm build
RUN cd ../examples/typescript && pnpm install --frozen-lockfile && pnpm build

# Run the facilitator
WORKDIR /app/examples/typescript/facilitator
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "dist/index.js"]
