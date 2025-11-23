# FFmpeg Web

This project provides a web-based API for converting media files using FFmpeg.

## Features

- Upload media files.
- Convert to MP4 or MP3 with presets.
- Track conversion job status.
- Download the converted file.

## Docker Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your system
- For Windows users: Ensure Docker Desktop is running and WSL 2 backend is enabled

### Building the Docker Image

Build the Docker image using the following command:

```bash
docker build -t ffmpeg-web .
```

This will:
- Install FFmpeg and yt-dlp
- Install Node.js dependencies using pnpm
- Build the Next.js application in standalone mode
- Create an optimized production image

### Running the Container

Run the container with the following command:

```bash
docker run -d -p 3000:3000 --name ffmpeg-web-app ffmpeg-web
```

**Options:**
- `-d`: Run in detached mode (background)
- `-p 3000:3000`: Map port 3000 from container to host
- `--name ffmpeg-web-app`: Assign a name to the container

### Running with Custom Configuration

You can customize the container with environment variables:

```bash
docker run -d -p 3000:3000 \
  -e PORT=3000 \
  -e ENABLE_YOUTUBE=true \
  --name ffmpeg-web-app \
  ffmpeg-web
```

**Environment Variables:**
- `PORT`: Port number for the server (default: 3000)
- `ENABLE_YOUTUBE`: Enable YouTube download support (default: true)

### Managing the Container

**View logs:**
```bash
docker logs ffmpeg-web-app
```

**Follow logs in real-time:**
```bash
docker logs -f ffmpeg-web-app
```

**Stop the container:**
```bash
docker stop ffmpeg-web-app
```

**Start the container:**
```bash
docker start ffmpeg-web-app
```

**Remove the container:**
```bash
docker rm ffmpeg-web-app
```

### Troubleshooting

**Windows-specific issues:**

If you encounter build errors on Windows related to `.venv` or symbolic links, ensure:
1. The `.dockerignore` file includes `.venv` to exclude Python virtual environments
2. Docker Desktop is using WSL 2 backend (Settings → General → Use WSL 2 based engine)
3. You're running the build command from a terminal with proper permissions

**Common issues:**

- **Port already in use:** Change the host port mapping: `-p 8080:3000`
- **Build fails:** Clear Docker cache: `docker build --no-cache -t ffmpeg-web .`
- **Container exits immediately:** Check logs with `docker logs ffmpeg-web-app`

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

