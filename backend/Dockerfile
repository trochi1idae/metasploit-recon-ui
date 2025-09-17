# backend/Dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Optional: small set of useful runtime tools; none strictly required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Python deps into the system interpreter (slim + wheels = fine)
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r /app/requirements.txt

# Copy app code
COPY . /app

# Create workspace for artifacts
RUN mkdir -p /app/workspace

EXPOSE 8000
CMD ["uvicorn", "run_backend:app", "--host", "0.0.0.0", "--port", "8000"]
