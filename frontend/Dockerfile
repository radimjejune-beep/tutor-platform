# Build context: frontend. RelaxDev build type: Docker.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=https://api.lessonfold.ru
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/scripts/static-server.mjs ./scripts/static-server.mjs
USER node
EXPOSE 8080
CMD ["node", "scripts/static-server.mjs"]
