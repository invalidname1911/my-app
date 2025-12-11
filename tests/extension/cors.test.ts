/**
 * CORS and API endpoint tests for Chrome Extension compatibility
 * Run with: npx ts-node tests/extension/cors.test.ts
 * Or use with a test runner after configuring
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function log(result: TestResult) {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  results.push(result);
}

async function testCorsHeaders() {
  console.log('\n🧪 Testing CORS Headers...\n');

  // Test OPTIONS preflight request
  try {
    const response = await fetch(`${API_BASE}/api/youtube-to-mp3`, {
      method: 'OPTIONS',
    });

    const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
    const corsMethods = response.headers.get('Access-Control-Allow-Methods');
    const corsHeaders = response.headers.get('Access-Control-Allow-Headers');

    log({
      name: 'CORS Allow-Origin header',
      passed: corsOrigin === '*',
      message: corsOrigin ? `Value: ${corsOrigin}` : 'Header missing',
    });

    log({
      name: 'CORS Allow-Methods header',
      passed: !!(corsMethods?.includes('GET') && corsMethods?.includes('POST')),
      message: corsMethods ? `Value: ${corsMethods}` : 'Header missing',
    });

    log({
      name: 'CORS Allow-Headers header',
      passed: !!corsHeaders?.includes('Content-Type'),
      message: corsHeaders ? `Value: ${corsHeaders}` : 'Header missing',
    });
  } catch (error: any) {
    log({
      name: 'CORS preflight request',
      passed: false,
      message: `Failed: ${error.message}`,
    });
  }
}

async function testYouTubeEndpoint() {
  console.log('\n🧪 Testing YouTube API Endpoint...\n');

  // Test POST /api/youtube-to-mp3
  try {
    const response = await fetch(`${API_BASE}/api/youtube-to-mp3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        bitrate: 192,
      }),
    });

    const status = response.status;

    if (status === 403) {
      log({
        name: 'YouTube endpoint enabled',
        passed: false,
        message: 'ENABLE_YOUTUBE=true is not set in environment',
      });
      return null;
    }

    if (status === 200 || status === 201) {
      const data = await response.json();
      log({
        name: 'YouTube endpoint enabled',
        passed: true,
        message: 'Endpoint is accessible',
      });

      log({
        name: 'Response has jobId',
        passed: !!data.jobId,
        message: data.jobId ? `jobId: ${data.jobId}` : 'Missing jobId',
      });

      return data.jobId;
    }

    log({
      name: 'YouTube endpoint response',
      passed: false,
      message: `Unexpected status: ${status}`,
    });
    return null;
  } catch (error: any) {
    log({
      name: 'YouTube endpoint request',
      passed: false,
      message: `Failed: ${error.message}`,
    });
    return null;
  }
}

async function testJobStatusEndpoint(jobId: string) {
  console.log('\n🧪 Testing Job Status Endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
    const data = await response.json();

    log({
      name: 'Job status endpoint accessible',
      passed: response.status === 200,
      message: `Status: ${response.status}`,
    });

    log({
      name: 'Response has status field',
      passed: !!data.status,
      message: data.status ? `Status: ${data.status}` : 'Missing status',
    });

    const validStatuses = ['queued', 'running', 'done', 'error'];
    log({
      name: 'Status is valid JobStatus',
      passed: validStatuses.includes(data.status),
      message: `Value: ${data.status}`,
    });

    // Check CORS on this endpoint too
    const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
    log({
      name: 'Job endpoint has CORS headers',
      passed: corsOrigin === '*',
      message: corsOrigin ? `Value: ${corsOrigin}` : 'Header missing',
    });
  } catch (error: any) {
    log({
      name: 'Job status endpoint request',
      passed: false,
      message: `Failed: ${error.message}`,
    });
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('Chrome Extension API Compatibility Tests');
  console.log(`API Base: ${API_BASE}`);
  console.log('='.repeat(50));

  await testCorsHeaders();
  const jobId = await testYouTubeEndpoint();

  if (jobId) {
    // Wait a moment for job to be registered
    await new Promise((r) => setTimeout(r, 1000));
    await testJobStatusEndpoint(jobId);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Backend is ready for Chrome extension.');
    process.exit(0);
  }
}

runTests().catch(console.error);
