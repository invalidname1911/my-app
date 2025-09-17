
import { GET } from '../app/api/jobs/[id]/route';
import { setJob, Job } from '../lib/jobs';
import { NextRequest } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TEMP_DIR = path.join(__dirname, 'temp-test-jobs');

async function setup() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

async function cleanup() {
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

function createMockRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`);
}

async function runTest(name: string, testFn: () => Promise<void>) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\n🧪 Running: ${name}`);
  }
  try {
    await testFn();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`✅ Passed: ${name}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`❌ Failed: ${name}`, error);
    }
    throw error; // re-throw to fail main process
  }
}

async function main() {
  await setup();

  try {
    await runTest('Job Not Found', async () => {
      const req = createMockRequest('/api/jobs/non-existent-id');
      const res = await GET(req, { params: { id: 'non-existent-id' } });
      if (res.status !== 404) {
        throw new Error(`Expected status 404, but got ${res.status}`);
      }
      const body = await res.json();
      if (body.error !== 'Job not found') {
        throw new Error(`Expected error 'Job not found', but got '${body.error}'`);
      }
    });

    await runTest('Job Status - Running', async () => {
      const jobId = 'running-job';
      const job: Job = {
        id: jobId,
        status: 'running',
        progress: 50,
        inputPath: 'dummy',
        target: 'mp4',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setJob(job);

      const req = createMockRequest(`/api/jobs/${jobId}`);
      const res = await GET(req, { params: { id: jobId } });
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const body = await res.json();
      if (body.status !== 'running' || body.progress !== 50) {
        throw new Error(`Unexpected body: ${JSON.stringify(body)}`);
      }
    });

    await runTest('Job Status - Done', async () => {
      const jobId = 'done-job';
      const job: Job = { id: jobId, status: 'done', inputPath: 'dummy', target: 'mp4', outputPath: 'dummy-output', createdAt: new Date(), updatedAt: new Date() };
      setJob(job);

      const req = createMockRequest(`/api/jobs/${jobId}`);
      const res = await GET(req, { params: { id: jobId } });
      const body = await res.json();
      if (body.status !== 'done' || body.downloadUrl !== `/api/jobs/${jobId}?download=1`) {
        throw new Error(`Unexpected body: ${JSON.stringify(body)}`);
      }
    });

    await runTest('Job Status - Error', async () => {
        const jobId = 'error-job';
        const errorMsg = 'Conversion failed';
        const job: Job = { id: jobId, status: 'error', error: errorMsg, inputPath: 'dummy', target: 'mp4', createdAt: new Date(), updatedAt: new Date() };
        setJob(job);

        const req = createMockRequest(`/api/jobs/${jobId}`);
        const res = await GET(req, { params: { id: jobId } });
        const body = await res.json();
        if (body.status !== 'error' || body.error !== errorMsg) {
            throw new Error(`Unexpected body: ${JSON.stringify(body)}`);
        }
    });

    await runTest('Download - Not Ready', async () => {
        const jobId = 'not-ready-job';
        const job: Job = { id: jobId, status: 'running', inputPath: 'dummy', target: 'mp4', createdAt: new Date(), updatedAt: new Date() };
        setJob(job);

        const req = createMockRequest(`/api/jobs/${jobId}?download=1`);
        const res = await GET(req, { params: { id: jobId } });
        if (res.status !== 400) throw new Error(`Expected status 400, got ${res.status}`);
        const body = await res.json();
        if (!body.error.includes('not yet complete')) {
            throw new Error(`Unexpected error message: ${body.error}`);
        }
    });

    await runTest('Download - Success', async () => {
        const jobId = 'downloadable-job';
        const dummyContent = 'this is a test file';
        const dummyPath = path.join(TEMP_DIR, 'output.mp4');
        await fs.writeFile(dummyPath, dummyContent);

        const job: Job = { id: jobId, status: 'done', inputPath: 'dummy', outputPath: dummyPath, target: 'mp4', createdAt: new Date(), updatedAt: new Date() };
        setJob(job);

        const req = createMockRequest(`/api/jobs/${jobId}?download=1`);
        const res = await GET(req, { params: { id: jobId } });

        if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
        const text = await res.text();
        if (text !== dummyContent) {
            throw new Error('Downloaded content does not match');
        }
        const contentType = res.headers.get('content-type');
        if (contentType !== 'video/mp4') {
            throw new Error(`Expected content-type video/mp4, got ${contentType}`);
        }
    });

  } finally {
    await cleanup();
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log('\n🎉 All job route tests passed!');
  }
}

main().catch(() => process.exit(1));
