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

# Check auth state
echo "🔐 Checking Google auth state..."
if [ -f "/app/google-session/auth-state.json" ]; then
    echo "✅ Google auth state found"
else
    echo "⚠️  No Google auth. Use the auth endpoint to setup."
    echo "   POST http://localhost:3099/auth/setup"
fi

echo "🤖 Starting Meeting Bot Worker + Auth Server..."

# Start auth server in background
node src/setupAuth.js --server &

# Start main worker
exec node src/worker.js
