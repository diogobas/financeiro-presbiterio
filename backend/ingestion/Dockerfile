# Ingestion Service (Node.js + TypeScript)
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies (expects package.json/lock later)
COPY package*.json . 2>/dev/null || true
RUN if [ -f package.json ]; then npm ci || npm install; fi

# Copy source (if present) and build
COPY . .
RUN if [ -f tsconfig.json ]; then npm run build || true; fi

EXPOSE 8080
CMD ["sh", "-c", "npm run start || node dist/index.js || node src/index.js"]
