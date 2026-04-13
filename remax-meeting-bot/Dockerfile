FROM mcr.microsoft.com/playwright:v1.49.1-noble

# Install audio/video dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pulseaudio \
    ffmpeg \
    xvfb \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

# Configure PulseAudio for headless
RUN mkdir -p /root/.config/pulse && \
    echo "default-server = unix:/tmp/pulse-socket" > /root/.config/pulse/client.conf

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# Install Playwright Chromium browser
RUN npx playwright install chromium --with-deps

COPY src/ ./src/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy auth state if available (from local login)
COPY auth-state.json /app/google-session/auth-state.json

ENV NODE_ENV=production
ENV DISPLAY=:99
ENV BOT_USER_DATA_DIR=/app/google-session

# Expose auth server port
EXPOSE 3099

CMD ["/entrypoint.sh"]
