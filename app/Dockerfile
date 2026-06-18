FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
COPY backend ./backend
COPY frontend ./frontend

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV APP_ENV=production \
    BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8787 \
    APP_BASE_PATH=/agent-roundtable-studio \
    DATA_DIR=/data \
    AI_RUNTIME=simulated

COPY package.json ./
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

RUN mkdir -p /data

EXPOSE 8787

CMD ["node", "backend/src/server.mjs"]
