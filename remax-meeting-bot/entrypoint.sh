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
echo "🤖 Starting Meeting Bot Worker..."

exec node src/worker.js
