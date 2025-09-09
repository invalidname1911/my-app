#!/usr/bin/env node

/**
 * Test script for the upload API route
 * This tests the /api/upload endpoint functionality
 *
 * Prerequisites:
 * 1. Start the development server: pnpm dev
 * 2. The server should be running on http://localhost:3000
 *
 * Run with: node tests/test-upload.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/upload`;

// Test files to use (create sample files for testing)
const TEST_FILES = [
  {
    name: 'test-video.mp4',
    type: 'video/mp4',
    size: 1024 * 1024, // 1MB
    content: Buffer.from('fake video content for testing')
  },
  {
    name: 'test-audio.mp3',
    type: 'audio/mpeg',
    size: 512 * 1024, // 512KB
    content: Buffer.from('fake audio content for testing')
  }
];

class UploadTester {
  constructor() {
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📋';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async createTestFile(testFile) {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, testFile.name);
    fs.writeFileSync(filePath, testFile.content);
    return filePath;
  }

  async cleanupTestFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async makeRequest(method, url, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  async createFormData(filePath, fieldName = 'file') {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    let formData = '';
    
    // Add file part
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`;
    formData += `Content-Type: video/mp4\r\n\r\n`;
    formData += fileContent.toString('binary');
    formData += `\r\n`;
    
    // End boundary
    formData += `--${boundary}--\r\n`;
    
    return {
      data: formData,
      boundary: boundary
    };
  }

  async testNoFileUpload() {
    this.log('Testing upload with no file...');
    
    try {
      const response = await this.makeRequest('POST', API_URL);
      
      if (response.statusCode === 400) {
        const body = JSON.parse(response.body);
        if (body.error === 'No file provided') {
          this.log('✅ No file upload test passed - correctly rejected request');
          return true;
        }
      }
      
      this.log('❌ No file upload test failed - expected 400 with proper error message', 'error');
      return false;
    } catch (error) {
      this.log(`❌ No file upload test failed - ${error.message}`, 'error');
      return false;
    }
  }

  async testInvalidContentType() {
    this.log('Testing upload with invalid content type...');
    
    try {
      const response = await this.makeRequest('POST', API_URL, 
        JSON.stringify({ wrong: 'data' }),
        { 'Content-Type': 'application/json' }
      );
      
      if (response.statusCode === 400) {
        const body = JSON.parse(response.body);
        if (body.error === 'No file provided') {
          this.log('✅ Invalid content type test passed - correctly rejected request');
          return true;
        }
      }
      
      this.log('❌ Invalid content type test failed', 'error');
      return false;
    } catch (error) {
      this.log(`❌ Invalid content type test failed - ${error.message}`, 'error');
      return false;
    }
  }

  async testValidFileUpload() {
    this.log('Testing valid file upload...');
    
    const testFile = TEST_FILES[0];
    const filePath = await this.createTestFile(testFile);
    
    try {
      const formData = await this.createFormData(filePath);
      const headers = {
        'Content-Type': `multipart/form-data; boundary=${formData.boundary}`,
        'Content-Length': Buffer.byteLength(formData.data)
      };
      
      const response = await this.makeRequest('POST', API_URL, formData.data, headers);
      
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        
        if (body.fileId && body.originalName && body.size) {
          this.log('✅ Valid file upload test passed');
          this.log(`   File ID: ${body.fileId}`);
          this.log(`   Original name: ${body.originalName}`);
          this.log(`   Size: ${body.size} bytes`);
          
          // Check if file was actually saved
          const tempDir = path.join(__dirname, '..', 'temp');
          const savedFiles = fs.readdirSync(tempDir);
          const matchingFile = savedFiles.find(file => file.includes(body.fileId));
          
          if (matchingFile) {
            this.log('✅ File was successfully saved to temp directory');
            return true;
          } else {
            this.log('❌ File was not found in temp directory', 'error');
            return false;
          }
        }
      }
      
      this.log('❌ Valid file upload test failed', 'error');
      return false;
    } catch (error) {
      this.log(`❌ Valid file upload test failed - ${error.message}`, 'error');
      return false;
    } finally {
      await this.cleanupTestFile(filePath);
    }
  }

  async testLargeFileUpload() {
    this.log('Testing large file upload (should be rejected)...');
    
    // Create a file larger than the limit (200MB)
    const largeFile = {
      name: 'large-file.mp4',
      type: 'video/mp4',
      size: 201 * 1024 * 1024, // 201MB
      content: Buffer.alloc(201 * 1024 * 1024, 'x') // Create large buffer
    };
    
    const filePath = await this.createTestFile(largeFile);
    
    try {
      const formData = await this.createFormData(filePath);
      const headers = {
        'Content-Type': `multipart/form-data; boundary=${formData.boundary}`,
        'Content-Length': Buffer.byteLength(formData.data)
      };
      
      const response = await this.makeRequest('POST', API_URL, formData.data, headers);
      
      if (response.statusCode === 400) {
        const body = JSON.parse(response.body);
        if (body.error.includes('exceeds')) {
          this.log('✅ Large file upload test passed - correctly rejected oversized file');
          return true;
        }
      }
      
      this.log('❌ Large file upload test failed', 'error');
      return false;
    } catch (error) {
      this.log(`❌ Large file upload test failed - ${error.message}`, 'error');
      return false;
    } finally {
      await this.cleanupTestFile(filePath);
    }
  }

  async testInvalidFileType() {
    this.log('Testing invalid file type upload...');
    
    // Create a file with invalid extension
    const invalidFile = {
      name: 'test.exe',
      type: 'application/x-msdownload',
      size: 1024,
      content: Buffer.from('executable content')
    };
    
    const filePath = await this.createTestFile(invalidFile);
    
    try {
      const formData = await this.createFormData(filePath);
      const headers = {
        'Content-Type': `multipart/form-data; boundary=${formData.boundary}`,
        'Content-Length': Buffer.byteLength(formData.data)
      };
      
      const response = await this.makeRequest('POST', API_URL, formData.data, headers);
      
      if (response.statusCode === 400) {
        const body = JSON.parse(response.body);
        if (body.error === 'File type not supported') {
          this.log('✅ Invalid file type test passed - correctly rejected unsupported file type');
          return true;
        }
      }
      
      this.log('❌ Invalid file type test failed', 'error');
      return false;
    } catch (error) {
      this.log(`❌ Invalid file type test failed - ${error.message}`, 'error');
      return false;
    } finally {
      await this.cleanupTestFile(filePath);
    }
  }

  async runAllTests() {
    this.log('🧪 Starting Upload API Tests...\n');
    
    // Check if server is running
    this.log('Checking if server is running...');
    try {
      const response = await this.makeRequest('GET', `${BASE_URL}/api/health`);
      if (response.statusCode === 200) {
        this.log('✅ Server is running and health check passed');
      } else {
        this.log('❌ Server is running but health check failed', 'error');
        return;
      }
    } catch (error) {
      this.log('❌ Server is not running. Please start the server with "pnpm dev"', 'error');
      return;
    }
    
    const tests = [
      this.testNoFileUpload.bind(this),
      this.testInvalidContentType.bind(this),
      this.testValidFileUpload.bind(this),
      this.testLargeFileUpload.bind(this),
      this.testInvalidFileType.bind(this)
    ];
    
    let passed = 0;
    let total = tests.length;
    
    for (const test of tests) {
      try {
        const result = await test();
        if (result) passed++;
      } catch (error) {
        this.log(`❌ Test failed with error: ${error.message}`, 'error');
      }
      console.log(''); // Add spacing between tests
    }
    
    this.log(`🎉 Upload API Tests Complete: ${passed}/${total} passed`);
    
    if (passed === total) {
      this.log('✅ All tests passed! The upload API is working correctly.');
    } else {
      this.log(`❌ ${total - passed} test(s) failed. Please check the implementation.`, 'error');
    }
  }
}

// Run the tests
const tester = new UploadTester();
tester.runAllTests().catch(console.error);