FROM python:3.12-alpine

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    AI_RUNTIME=dev \
    ORCHESTRATOR_HOST=0.0.0.0 \
    ORCHESTRATOR_PORT=8790 \
    DATA_DIR=/data

COPY ai-orchestrator-python/src ./ai-orchestrator-python/src

RUN mkdir -p /data \
    && python -m py_compile ai-orchestrator-python/src/orchestrator.py

EXPOSE 8790

CMD ["python", "ai-orchestrator-python/src/orchestrator.py"]
