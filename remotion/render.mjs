/**
 * Remotion Render Script
 * Usage: node render.mjs [props-file.json] [output-path]
 * 
 * Example:
 *   node render.mjs props.json out/tutorial.mp4
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const propsFile = process.argv[2] || 'props.json';
const outputFile = process.argv[3] || 'out/tutorial.mp4';

// Ensure output directory exists
const outDir = dirname(outputFile);
if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
}

// Read props
if (!existsSync(propsFile)) {
    console.error(`❌ Props file not found: ${propsFile}`);
    console.log('Usage: node render.mjs [props-file.json] [output-path]');
    process.exit(1);
}

const props = JSON.parse(readFileSync(propsFile, 'utf-8'));

// Calculate duration based on segments
const lastSegment = props.segments?.[props.segments.length - 1];
const contentDuration = (lastSegment?.endTime || lastSegment?.startTime + 30 || 60);
const totalDuration = contentDuration + 4 + 3; // + intro + outro
const durationInFrames = Math.ceil(totalDuration * 30); // 30fps

console.log(`\n🎬 RE/MAX Exclusive Tutorial Renderer`);
console.log(`─────────────────────────────────────`);
console.log(`📌 Title: ${props.title}`);
console.log(`🎙️  Segments: ${props.segments?.length || 0}`);
console.log(`⏱️  Duration: ${totalDuration.toFixed(1)}s (${durationInFrames} frames)`);
console.log(`📁 Output: ${outputFile}`);
console.log(`─────────────────────────────────────\n`);

// Escape props for CLI
const propsJson = JSON.stringify(props).replace(/'/g, "\\'");

try {
    execSync(
        `npx remotion render src/index.jsx TutorialVideo ${outputFile} --props='${propsJson}' --frames=0-${durationInFrames - 1}`,
        { stdio: 'inherit', cwd: import.meta.dirname }
    );
    console.log(`\n✅ Video rendered successfully: ${outputFile}`);
} catch (error) {
    console.error(`\n❌ Render failed:`, error.message);
    process.exit(1);
}
