const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

/**
 * Extracts duration in seconds and formatted mm:ss string from an audio file using FFmpeg.
 * @param {string} filePath 
 * @returns {Promise<{durationSeconds: number, durationFormatted: string}>}
 */
function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    // Run ffmpeg -i filePath to inspect stream metadata from stderr
    const proc = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', () => {
      // Look for "Duration: 00:03:45.12"
      const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.?(\d*)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        const totalSeconds = hours * 3600 + mins * 60 + secs;

        let formatted = '';
        if (hours > 0) {
          formatted = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } else {
          formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        resolve({ durationSeconds: totalSeconds, durationFormatted: formatted });
      } else {
        resolve({ durationSeconds: 0, durationFormatted: '00:00' });
      }
    });

    proc.on('error', () => {
      resolve({ durationSeconds: 0, durationFormatted: '00:00' });
    });
  });
}

/**
 * Converts any input audio file (MP3, WAV, M4A) to MP3 at 128 kbps.
 * Supports long recordings (12, 15, 30+ minutes).
 * 
 * @param {string} inputPath Path to the source uploaded audio file
 * @param {string} outputPath Path to write the converted MP3 file
 * @param {function} onProgress Optional progress callback
 * @returns {Promise<{outputPath: string, durationFormatted: string, durationSeconds: number, fileSize: number}>}
 */
function convertToMp3128k(inputPath, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file does not exist: ${inputPath}`));
    }

    // First inspect duration for progress tracking
    getAudioDuration(inputPath).then(({ durationSeconds, durationFormatted }) => {
      const args = [
        '-i', inputPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-y',
        outputPath
      ];

      const proc = spawn(ffmpegPath, args);
      let errorOutput = '';

      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        errorOutput += text;

        if (onProgress && durationSeconds > 0) {
          // Parse time=00:01:23.45 to calculate conversion percentage
          const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.?(\d*)/);
          if (timeMatch) {
            const h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            const s = parseInt(timeMatch[3], 10);
            const currentSeconds = h * 3600 + m * 60 + s;
            const percent = Math.min(99, Math.round((currentSeconds / durationSeconds) * 100));
            onProgress(percent);
          }
        }
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          resolve({
            outputPath,
            durationFormatted,
            durationSeconds,
            fileSize: stats.size
          });
        } else {
          reject(new Error(`FFmpeg conversion failed (exit code ${code}): ${errorOutput.slice(-300)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg: ${err.message}`));
      });
    }).catch(reject);
  });
}

module.exports = {
  convertToMp3128k,
  getAudioDuration
};

