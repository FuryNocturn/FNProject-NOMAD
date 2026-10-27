# NOMAD Arcade: offline single-player games, served as a static site.
#
# Two stages: Node builds the Vite/React site (and runs the game-logic tests,
# so a broken AI or puzzle generator fails the build), then only the static
# files are copied into nginx. No Node, no server code, no volumes at runtime;
# saved games live in each browser's localStorage.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
