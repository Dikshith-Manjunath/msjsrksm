FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PYTHONPATH=/app

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for blazing-fast package management
RUN pip install --no-cache-dir uv

# Copy dependency specifications
COPY requirements.txt pyproject.toml /app/

# Install Python dependencies using uv
RUN uv pip install --system --no-cache -r requirements.txt

# Copy backend source code
COPY app /app/app
COPY scripts /app/scripts
COPY tests /app/tests

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

EXPOSE 8000

# Healthcheck for container orchestrators (Render / Kubernetes / Docker)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
