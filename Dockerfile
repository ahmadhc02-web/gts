FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy dependency configuration files
COPY package*.json ./

# Install dependencies (including devDependencies required for build step)
RUN npm install

# Copy the rest of the application files
COPY . .

# Build Vite client assets & bundle the server.ts file into dist/server.cjs
RUN npm run build

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=7860

# Expose the port used by Hugging Face Space
EXPOSE 7860

# Start the Express production server
CMD ["npm", "start"]
