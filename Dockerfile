FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV BODY_SIZE_LIMIT=100M
ENV MAX_EVIDENCE_BYTES=26214400
ENV DATA_REPO_PATH=/data
ENV CACHE_DB_PATH=/cache/comptes.sqlite
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /data /cache && chown node:node /data /cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/build ./build
USER node
HEALTHCHECK --interval=2s --timeout=2s --start-period=5s --retries=30 CMD node -e "fetch('http://127.0.0.1:3000/accounts').then(r=>process.exit([200,401].includes(r.status)?0:1)).catch(()=>process.exit(1))"
EXPOSE 3000
CMD ["node", "build"]
