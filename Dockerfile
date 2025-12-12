# ---------- build stage ----------
FROM node:22-slim AS builder
WORKDIR /app

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

COPY package*.json ./
# Install ALL deps (including devDependencies) so tsc exists
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-slim
WORKDIR /app

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production

COPY package*.json ./
# Install production deps only
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["npm","start"]
