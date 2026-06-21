# ==========================================
# Stage 1: Build inside a Node.js container
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency catalogs
COPY package.json package-lock.json ./

# Install all development and runtime dependencies
RUN npm ci

# Copy the rest of the workspace source code
COPY . .

# Run production build (Vite compilation + esbuild server transpilation)
RUN npm run build

# ==========================================
# Stage 2: Clean and lightweight runner environment
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy output bundles from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/dist ./dist

# Install ONLY production dependencies to keep the image extremely light
RUN npm ci --only=production

# Expose the communication port (default: 3000 to match production proxy routing)
EXPOSE 3000

# Start command running the compiled server bundle
CMD ["node", "dist/server.cjs"]
