FROM node:22-slim

WORKDIR /app

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm","start"]