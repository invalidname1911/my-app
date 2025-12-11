# Chrome Extension API Tests

Tests to verify the backend API is properly configured for the Chrome extension.

## What's Tested

1. **CORS Headers** - Verifies `Access-Control-Allow-*` headers are set
2. **YouTube Endpoint** - Tests `/api/youtube-to-mp3` is accessible and returns jobId
3. **Job Status Endpoint** - Tests `/api/jobs/[id]` returns proper status

## Running Tests

### Against Local Server

```bash
# Start the dev server first
pnpm dev

# In another terminal, run tests
npx tsx tests/extension/cors.test.ts
```

### Against Production

```bash
API_BASE_URL=https://your-app.railway.app npx tsx tests/extension/cors.test.ts
```

## Expected Output

```
==================================================
Chrome Extension API Compatibility Tests
API Base: http://localhost:3000
==================================================

🧪 Testing CORS Headers...

✅ CORS Allow-Origin header: Value: *
✅ CORS Allow-Methods header: Value: GET, POST, OPTIONS
✅ CORS Allow-Headers header: Value: Content-Type

🧪 Testing YouTube API Endpoint...

✅ YouTube endpoint enabled: Endpoint is accessible
✅ Response has jobId: jobId: abc123...

🧪 Testing Job Status Endpoint...

✅ Job status endpoint accessible: Status: 200
✅ Response has status field: Status: running
✅ Status is valid JobStatus: Value: running
✅ Job endpoint has CORS headers: Value: *

==================================================
Test Summary
==================================================

✅ Passed: 8
❌ Failed: 0
📊 Total: 8

🎉 All tests passed! Backend is ready for Chrome extension.
```

## Troubleshooting

### CORS headers missing
- Ensure `next.config.mjs` has the `headers()` function configured
- Restart the dev server after config changes

### YouTube endpoint returns 403
- Set `ENABLE_YOUTUBE=true` in `.env.local`
- Restart the dev server

### Connection refused
- Make sure the dev server is running on the expected port
- Check `API_BASE_URL` matches your server address
