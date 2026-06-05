FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY dist/apps/sync-api ./
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod
EXPOSE 8787
CMD ["node", "main.js"]
