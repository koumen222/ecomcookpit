# Multi-stage build: frontend + backend
FROM node:22-alpine AS frontend

WORKDIR /app

ARG BUILD_VERSION=local
ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_BACKEND_URL
ARG VITE_STORE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST

ENV BUILD_VERSION=$BUILD_VERSION \
    GIT_COMMIT=$BUILD_VERSION \
    VITE_API_URL=$VITE_API_URL \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_STORE_API_URL=$VITE_STORE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST

COPY package*.json ./
RUN npm ci --no-audit

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app/Backend

ARG BUILD_VERSION=local
ENV NODE_ENV=production \
    PORT=8080 \
    BUILD_VERSION=$BUILD_VERSION \
    GIT_COMMIT=$BUILD_VERSION

COPY Backend/package*.json ./
RUN npm ci --omit=dev --no-audit

COPY Backend/ ./
COPY --from=frontend /app/dist ./client/build

RUN mkdir -p uploads

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
