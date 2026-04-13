/**
 * Audio Capture — Records system audio using FFmpeg + PulseAudio
 */
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const RECORDINGS_DIR = '/tmp/recordings';

// Ensure recordings directory exists
if (!existsSync(RECORDINGS_DIR)) {
    mkdirSync(RECORDINGS_DIR, { recursive: true });
}

/**
 * Start recording system audio
 * @param {string} sessionId - Unique session ID for the file
 * @returns {{ process: ChildProcess, outputPath: string, stop: () => Promise<string> }}
 */
export function startAudioCapture(sessionId) {
    const outputPath = path.join(RECORDINGS_DIR, `${sessionId}.wav`);

    console.log(`[AudioCapture] Starting FFmpeg capture → ${outputPath}`);

    const ffmpegProcess = spawn('ffmpeg', [
        '-y',                          // Overwrite output
        '-f', 'pulse',                 // PulseAudio input
        '-i', 'VirtualSink.monitor',   // Monitor the virtual sink (captures all audio)
        '-ac', '1',                    // Mono
        '-ar', '16000',                // 16kHz (optimal for Whisper)
        '-acodec', 'pcm_s16le',        // 16-bit PCM
        outputPath,
    ], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    ffmpegProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('size=') || msg.includes('time=')) {
            // Progress updates — log occasionally
            if (Math.random() < 0.05) {
                console.log(`[AudioCapture] ${msg.substring(0, 80)}`);
            }
        }
    });

    ffmpegProcess.on('error', (err) => {
        console.error('[AudioCapture] FFmpeg error:', err.message);
    });

    const stop = () => {
        return new Promise((resolve, reject) => {
            if (ffmpegProcess.killed) {
                resolve(outputPath);
                return;
            }

            // Send 'q' to gracefully stop FFmpeg
            ffmpegProcess.stdin.write('q');
            ffmpegProcess.stdin.end();

            const timeout = setTimeout(() => {
                ffmpegProcess.kill('SIGKILL');
                resolve(outputPath);
            }, 5000);

            ffmpegProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`[AudioCapture] FFmpeg stopped (code: ${code})`);
                resolve(outputPath);
            });
        });
    };

    return {
        process: ffmpegProcess,
        outputPath,
        stop,
    };
}

/**
 * Convert WAV to WebM for smaller file size
 */
export function convertToWebm(wavPath) {
    const webmPath = wavPath.replace('.wav', '.webm');

    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
            '-y',
            '-i', wavPath,
            '-c:a', 'libopus',
            '-b:a', '128k',
            '-vn',
            webmPath,
        ]);

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`[AudioCapture] Converted to WebM: ${webmPath}`);
                resolve(webmPath);
            } else {
                console.error(`[AudioCapture] WebM conversion failed (code: ${code})`);
                // Fall back to WAV
                resolve(wavPath);
            }
        });

        proc.on('error', (err) => {
            console.error('[AudioCapture] FFmpeg conversion error:', err.message);
            resolve(wavPath); // Fall back to WAV
        });
    });
}
