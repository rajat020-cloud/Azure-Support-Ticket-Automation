# Stage 1: Build TypeScript source
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY sample_data ./sample_data

RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/sample_data ./sample_data

# Run with non-root node user for least-privilege container security
RUN chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
