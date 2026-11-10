FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-sin tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.lock /tmp/requirements.lock
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export PIP_CERT=/run/secrets/build_ca; fi; \
    pip install -r /tmp/requirements.lock && \
    if [ -f /run/secrets/build_ca ]; then \
      python -c "from pathlib import Path; import certifi; p=Path(certifi.where()); p.write_bytes(p.read_bytes()+b'\\n'+Path('/run/secrets/build_ca').read_bytes())"; \
    fi
COPY backend/ /app/backend/
RUN pip install --no-deps --no-build-isolation ./backend && useradd --create-home appuser && mkdir /app/storage && chown appuser:appuser /app/storage
ENV PYTEST_ADDOPTS="-p no:cacheprovider"
USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic -c backend/alembic.ini upgrade head && exec uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
