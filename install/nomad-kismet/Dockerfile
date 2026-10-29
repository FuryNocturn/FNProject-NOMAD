# Kismet for NOMAD: Wi-Fi monitoring with a web UI on port 2501. Packages come
# from Kismet's official Debian repository (kismet-core and the Linux capture
# tools; the "kismet" meta-package also wants a capture driver for one specific
# device that is not published for every platform). Run with host networking
# and NET_ADMIN/NET_RAW so it can see and
# put the host's Wi-Fi adapters in monitor mode (Linux only; a monitor-mode
# capable adapter is needed to capture). On first visit the web UI asks you to
# create the admin login, so there are no default credentials.
FROM debian:bookworm-slim
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget gnupg \
    && wget -qO- https://www.kismetwireless.net/repos/kismet-release.gpg.key \
       | gpg --dearmor > /usr/share/keyrings/kismet-archive-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/kismet-archive-keyring.gpg] https://www.kismetwireless.net/repos/apt/release/bookworm bookworm main' \
       > /etc/apt/sources.list.d/kismet.list \
    && apt-get update \
    && echo 'kismet-capture-common kismet-capture-common/install-setuid boolean false' | debconf-set-selections \
    && apt-get install -y --no-install-recommends kismet-core kismet-capture-linux-wifi kismet-capture-linux-bluetooth kismet-logtools iw wireless-tools \
    && apt-get purge -y gnupg wget && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
# Settings and logins in /root/.kismet, capture logs in /logs (both volumes).
WORKDIR /logs
EXPOSE 2501
# bash, not sh: the check opens a TCP connection to the web UI with /dev/tcp.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/2501"]
ENV HOME=/root
ENTRYPOINT ["kismet", "--no-ncurses"]
