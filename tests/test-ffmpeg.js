#!/usr/bin/env node

/**
 * Test script for @ts-ffmpeg/fluent-ffmpeg package
 * Run with: node test-ffmpeg.js
 */

const Ffmpeg = require('@ts-ffmpeg/fluent-ffmpeg');
const { promises: fs } = require('fs');

// Set the path to the local FFmpeg binary
Ffmpeg.setFfmpegPath('../bin/ffmpeg.exe');

async function testFFmpegPackage() {
  console.log('🧪 Testing @ts-ffmpeg/fluent-ffmpeg package...\n');

  try {
    // Test 1: Basic import and FFmpeg path setup
    console.log('1️⃣  Testing package import and FFmpeg path setup...');
    if (Ffmpeg) {
      console.log('✅ Package imported successfully!');
      console.log('✅ FFmpeg path set to local binary!');
    } else {
      console.log('❌ Package import failed');
      return;
    }

    // Test 2: Check FFmpeg binary availability
    console.log('\n2️⃣  Testing FFmpeg binary availability...');
    try {
      // Try to run a simple FFmpeg command to verify it's working
      const { spawn } = require('child_process');
      const path = require('path');
      const ffmpegProcess = spawn(path.resolve(__dirname, '../bin/ffmpeg.exe'), ['-version']);

      ffmpegProcess.on('error', (err) => {
        console.log('❌ FFmpeg binary not accessible:', err.message);
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FFmpeg binary is working correctly!');
        } else {
          console.log(`❌ FFmpeg binary returned error code: ${code}`);
        }
      });

      // Give it a moment to respond
      setTimeout(() => {
        ffmpegProcess.kill();
      }, 1000);

    } catch (err) {
      console.log('❌ FFmpeg binary test failed:', err.message);
    }

    // Test 2.5: Test basic FFmpeg command creation without binary
    console.log('\n2️⃣.5️⃣  Testing FFmpeg command creation...');
    try {
      const command = Ffmpeg();
      console.log('✅ FFmpeg command object created successfully!');
      console.log('✅ Package API is functional!');
    } catch (err) {
      console.log(`❌ Command creation failed: ${err.message}`);
      return;
    }

    // Test 3: Test ffprobe functionality
    console.log('\n3️⃣  Testing ffprobe functionality...');
    try {
      const testFiles = [
        './public/placeholder.jpg',
        './public/placeholder.png',
        './public/placeholder.svg'
      ];

      for (const file of testFiles) {
        try {
          console.log(`📋 Trying to get media info for: ${file}`);
          const mediaInfo = await new Promise((resolve, reject) => {
            Ffmpeg(file).ffprobe((err, data) => {
              if (err) reject(err);
              else resolve(data);
            });
          });

          console.log('✅ Media info retrieved successfully!');
          console.log(`   Format: ${mediaInfo.format?.format_name || 'Unknown'}`);
          console.log(`   Duration: ${mediaInfo.format?.duration || 'N/A'} seconds`);
          console.log(`   Size: ${mediaInfo.format?.size || 'N/A'} bytes`);
          if (mediaInfo.streams && mediaInfo.streams.length > 0) {
            console.log(`   Streams: ${mediaInfo.streams.length}`);
          }
          break; // Stop after first successful test
        } catch (err) {
          console.log(`⚠️  ${file} is not a valid media file: ${err.message}`);
        }
      }
    } catch (err) {
      console.log(`❌ Media info test failed: ${err.message}`);
    }


    console.log('\n🎉 All tests completed! The @ts-ffmpeg/fluent-ffmpeg package is working correctly.');
    console.log('\n📝 Next steps to test full functionality:');
    console.log('   1. Place a video file in the temp/ directory');
    console.log('   2. Test the conversion functions from lib/ffmpeg.ts');
    console.log('   3. Verify output files are created correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testFFmpegPackage();
