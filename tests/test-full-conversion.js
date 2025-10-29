#!/usr/bin/env node

/**
 * Full conversion test for @ts-ffmpeg/fluent-ffmpeg package
 * This tests the actual conversion functions from lib/ffmpeg.ts
 *
 * Prerequisites:
 * 1. Install a working FFmpeg binary
 * 2. Place a test video file in temp/test-input.mp4
 *
 * Run with: node test-full-conversion.js
 */

const Ffmpeg = require('@ts-ffmpeg/fluent-ffmpeg');
const { promises: fs } = require('fs');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');

// Set the path to the FFmpeg binary - use ffmpeg-static if available, fallback to local binary
const FFMPEG_PATH = ffmpegStatic || process.env.FFMPEG_PATH || path.resolve(__dirname, '../bin/ffmpeg.exe');
try {
  Ffmpeg.setFfmpegPath(FFMPEG_PATH);
  console.log(`✅ FFmpeg path set to: ${FFMPEG_PATH}`);
  console.log(`✅ FFmpeg source: ${ffmpegStatic ? 'ffmpeg-static' : 'local-binary'}`);
} catch (e) {
  console.log('⚠️  Could not set FFmpeg path:', e.message);
}

async function testFullConversion() {
  console.log('🎬 Testing full FFmpeg conversion functionality...\n');

  const inputPath = './temp/test-input.mp4';
  const outputMp4Path = './temp/test-output.mp4';
  const outputMp3Path = './temp/test-output.mp3';

  try {
    // Check if input file exists
    console.log('1️⃣  Checking for test input file...');
    try {
      await fs.access(inputPath);
      console.log('✅ Test input file found!');
    } catch (err) {
      console.log('❌ Test input file not found at:', inputPath);
      console.log('\n📝 To test conversion:');
      console.log('   1. Download a small MP4 video (e.g., Big Buck Bunny sample)');
      console.log('   2. Place it at:', path.resolve(inputPath));
      console.log('   3. Run this test again');
      return;
    }

    // Test 2: Get media info
    console.log('\n2️⃣  Getting media information...');
    const mediaInfo = await new Promise((resolve, reject) => {
      Ffmpeg(inputPath).ffprobe((err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    console.log('✅ Media info retrieved:');
    console.log(`   Duration: ${mediaInfo.format?.duration || 'N/A'} seconds`);
    console.log(`   Format: ${mediaInfo.format?.format_name || 'Unknown'}`);
    console.log(`   Size: ${mediaInfo.format?.size || 'N/A'} bytes`);

    // Test 3: Convert to MP4 (re-encoding)
    console.log('\n3️⃣  Testing MP4 conversion...');
    await new Promise((resolve, reject) => {
      Ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('640x360')
        .format('mp4')
        .addOptions(['-crf 28', '-preset fast'])
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`   Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('error', (err) => {
          reject(new Error(`MP4 conversion error: ${err.message}`));
        })
        .on('end', () => {
          console.log('✅ MP4 conversion completed!');
          resolve();
        })
        .save(outputMp4Path);
    });

    // Test 4: Extract audio to MP3
    console.log('\n4️⃣  Testing audio extraction...');
    await new Promise((resolve, reject) => {
      Ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(192)
        .format('mp3')
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`   Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('error', (err) => {
          reject(new Error(`Audio extraction error: ${err.message}`));
        })
        .on('end', () => {
          console.log('✅ Audio extraction completed!');
          resolve();
        })
        .save(outputMp3Path);
    });

    // Test 5: Verify output files
    console.log('\n5️⃣  Verifying output files...');
    const mp4Stats = await fs.stat(outputMp4Path);
    const mp3Stats = await fs.stat(outputMp3Path);

    console.log('✅ Output files created:');
    console.log(`   MP4: ${mp4Stats.size} bytes`);
    console.log(`   MP3: ${mp3Stats.size} bytes`);

    console.log('\n🎉 All conversion tests passed!');
    console.log('✅ The @ts-ffmpeg/fluent-ffmpeg package is fully functional!');

  } catch (error) {
    console.error('❌ Conversion test failed:', error.message);

    if (error.message.includes('spawn ffmpeg ENOENT')) {
      console.log('\n🔧 FFmpeg binary not found. Solutions:');
      console.log('   1. Install FFmpeg system-wide: https://ffmpeg.org/download.html');
      console.log('   2. Or download a static binary and place it in the ffmpeg-static path');
      console.log('   3. Or use a different FFmpeg wrapper that includes the binary');
    }
  }
}

// Run the test
testFullConversion();
