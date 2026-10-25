FROM python:3.13-slim

WORKDIR /app

COPY agent-backend/requirements.txt agent-backend/requirements.txt
RUN python -m pip install --no-cache-dir -r agent-backend/requirements.txt

COPY agent-backend/ agent-backend/
COPY data/ data/

WORKDIR /app/agent-backend

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
