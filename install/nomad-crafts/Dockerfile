# NOMAD Craft Suite: the storytold "*craft" web apps (MIT / Apache-2.0), each
# served from its own folder, plus a small home page that lists them.
#
# Release zips are pinned in crafts.json (version, URL, sha256) and checked at
# build time; a mismatch fails the build. The apps are static WebAssembly
# sites: no server code and no volumes, documents stay in the browser.
FROM alpine:3.22 AS fetch
RUN apk add --no-cache jq unzip
WORKDIR /work
COPY crafts.json .
RUN set -eu; mkdir -p /out; \
    for n in $(jq -r '.[].name' crafts.json); do \
      url=$(jq -r --arg n "$n" '.[] | select(.name == $n) | .url' crafts.json); \
      sum=$(jq -r --arg n "$n" '.[] | select(.name == $n) | .sha256' crafts.json); \
      wget -q -O "$n.zip" "$url"; \
      echo "$sum  $n.zip" | sha256sum -c -; \
      unzip -q "$n.zip" -d "x-$n"; \
      mv "x-$n"/*/ "/out/$n"; \
      # The loader in app/ imports ./snippets/... relative to app/, but the
      # release zips only ship snippets/ at the top (seen in photocraft 0.17.0).
      if [ -d "/out/$n/app" ] && [ -d "/out/$n/snippets" ] && [ ! -e "/out/$n/app/snippets" ]; then \
        cp -r "/out/$n/snippets" "/out/$n/app/"; \
      fi; \
      rm -rf "$n.zip" "x-$n"; \
    done; \
    # Store the big files pre-compressed: nginx serves the .gz as is (gzip_static)
    # and unzips on the fly for the rare client without gzip (gunzip).
    find /out -type f \( -name '*.wasm' -o -name '*.js' \) -size +4k -exec gzip -9 -f {} +

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=fetch /out /usr/share/nginx/html
COPY index.html crafts.json /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
