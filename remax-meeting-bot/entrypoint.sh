#!/bin/bash
set -e

echo "🖥️  Starting Xvfb virtual display..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
sleep 1

echo "🔊 Starting PulseAudio..."
pulseaudio -D --exit-idle-time=-1 --system --disallow-exit --disallow-module-loading=0 2>/dev/null || true
sleep 1

echo "🔊 Creating virtual audio sink..."
pactl load-module module-null-sink sink_name=VirtualSink sink_properties=device.description="VirtualSink" 2>/dev/null || true
pactl set-default-sink VirtualSink 2>/dev/null || true

echo "✅ Virtual display and audio ready"

# Restore Google auth state from env var if provided
if [ -n "$GOOGLE_AUTH_STATE_B64" ]; then
    echo "🔐 Restoring Google auth from environment variable..."
    mkdir -p /app/google-session
    echo "$GOOGLE_AUTH_STATE_B64" | base64 -d > /app/google-session/auth-state.json
    echo "✅ Google auth state restored ($(wc -c < /app/google-session/auth-state.json) bytes)"
elif [ -f "/app/google-session/auth-state.json" ]; then
    echo "✅ Google auth state found on disk"
else
    echo "⚠️  No Google auth. Set GOOGLE_AUTH_STATE_B64 env var or mount auth-state.json"
fi

echo "🤖 Starting Meeting Bot Worker..."

# Start main worker
exec node src/worker.js
