FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy application files
ADD . /app
WORKDIR /app

# Install dependencies
RUN uv sync --locked

ENV UV_CACHE_DIR=/tmp/uv-cache
ENV PORT=8080

CMD ["uv", "run", "agentcore_main.py"]
