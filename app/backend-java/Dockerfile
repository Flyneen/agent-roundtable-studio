FROM node:22-alpine AS frontend-build

WORKDIR /app
COPY package.json ./
COPY frontend ./frontend
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app
COPY backend-java/src ./backend-java/src

RUN mkdir -p /app/backend-java/build/classes \
    && find backend-java/src/main/java -name "*.java" > /tmp/sources.txt \
    && javac -encoding UTF-8 -d /app/backend-java/build/classes @/tmp/sources.txt

FROM eclipse-temurin:21-jre-alpine AS runtime

WORKDIR /app

ENV BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8787 \
    APP_BASE_PATH=/agent-roundtable-studio \
    STATIC_ROOT=/app/frontend/dist \
    AI_ORCHESTRATOR_URL=http://ai-orchestrator-python:8790 \
    AI_ORCHESTRATOR_TIMEOUT_MS=90000

COPY --from=build /app/backend-java/build/classes ./backend-java/classes
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8787

CMD ["java", "-cp", "backend-java/classes", "com.ars.AgentRoundtableGateway"]
