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

# Brick Game (vendored, MIT): its own create-react-app build, served at /brick/.
FROM node:22-alpine AS brick
WORKDIR /src
COPY vendor/brick-game/package.json vendor/brick-game/package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY vendor/brick-game/ ./
RUN PUBLIC_URL=. GENERATE_SOURCEMAP=false npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
COPY --from=brick /src/build /usr/share/nginx/html/brick
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
