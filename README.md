# FFmpeg Web

This project provides a web-based API for converting media files using FFmpeg.

## Features

- Upload media files.
- Convert to MP4 or MP3 with presets.
- Track conversion job status.
- Download the converted file.

## API Usage

### Upload a file

```bash
curl -F "file=@/path/to/your/sample.mp4" http://localhost:3000/api/upload
```

This will return a `fileId` that you can use in the next step.

### Start a conversion

```bash
curl -X POST http://localhost:3000/api/convert \
  -H 'content-type: application/json' \
  -d '{"fileId":"<your-file-id>","target":"mp4","preset":"web"}'
```

This will return a `jobId`.

### Poll for job status

```bash
curl http://localhost:3000/api/jobs/<your-job-id>
```

When the job is done, the response will include a `downloadUrl`.

### Download the converted file

```bash
curl -L "http://localhost:3000/api/jobs/<your-job-id>?download=1" -o output.mp4
```

