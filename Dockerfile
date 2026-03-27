# Multi-stage build: frontend + backend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit
COPY Backend/ ./
COPY --from=frontend /app/dist ./client/build
RUN npm install --omit=dev --no-audit
EXPOSE 8080
CMD ["node", "server.js"]
