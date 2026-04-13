FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Install audio/video dependencies
RUN apt-get update && apt-get install -y \
    pulseaudio \
    ffmpeg \
    xvfb \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

# Configure PulseAudio for headless
RUN mkdir -p /root/.config/pulse && \
    echo "default-server = unix:/tmp/pulse-socket" > /root/.config/pulse/client.conf

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

# Install Playwright browsers
RUN npx playwright install chromium

COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV DISPLAY=:99

CMD ["/entrypoint.sh"]
