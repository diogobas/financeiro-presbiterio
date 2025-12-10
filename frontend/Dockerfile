# Frontend (React + TypeScript)
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./ 2>/dev/null || true
RUN if [ -f package.json ]; then npm ci || npm install; fi

COPY . ./

# Dev server for local usage; production build can be added later
EXPOSE 5173
CMD ["sh","-c","npm run dev -- --host 0.0.0.0 || npm start || sleep 3600"]
