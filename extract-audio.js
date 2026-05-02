/**
 * One-time script to extract inline Base64 audio data from app.js into separate files.
 * Run: node extract-audio.js
 * Safe to delete after use.
 */
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// Extract the three base64 data URIs using regex
const sentMatch = appJs.match(/const SENT_SOUND_DATA\s*=\s*"(data:audio\/[^"]+)"/);
const recvMatch = appJs.match(/const RECV_SOUND_DATA\s*=\s*"(data:audio\/[^"]+)"/);
const switchMatch = appJs.match(/const SWITCH_SOUND_DATA\s*=\s*"(data:audio\/[^"]+)"/);

if (!sentMatch || !recvMatch || !switchMatch) {
    console.error('❌ Failed to extract one or more audio constants from app.js');
    process.exit(1);
}

// Create output directory
const outDir = path.join(__dirname, 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

function saveAudio(dataUri, filename) {
    const base64 = dataUri.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Saved: ${filename} (${buffer.length} bytes)`);
}

saveAudio(sentMatch[1], 'sent.mp3');
saveAudio(recvMatch[1], 'recv.mp3');
saveAudio(switchMatch[1], 'switch.wav');

console.log('\n🎉 All audio files extracted to assets/sounds/');
console.log('You can now delete this script (extract-audio.js).');
