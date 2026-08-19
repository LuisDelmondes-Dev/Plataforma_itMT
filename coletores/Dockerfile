FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --omit=dev && npm cache clean --force

COPY api/scripts ./api/scripts
COPY api/ingest-configs ./api/ingest-configs
COPY db ./db
COPY coletores ./coletores
RUN python3 -m venv /opt/itmt-venv \
 && /opt/itmt-venv/bin/pip install --no-cache-dir -r coletores/requirements.txt \
 && mkdir -p api/bronze coletores/.baixados \
 && chown -R node:node /workspace/api/bronze /workspace/coletores/.baixados

ENV PYTHON=/opt/itmt-venv/bin/python
ENV PYTHONUNBUFFERED=1
WORKDIR /workspace/api
USER node
