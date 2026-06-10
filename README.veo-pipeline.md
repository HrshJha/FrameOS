# Veo TypeScript Video Pipeline

This root-level pipeline generates a deterministic cinematic script from a topic, renders each scene through Google Veo, downloads the generated segments, and assembles the final MP4 with ffmpeg.

## Install

```bash
npm install
```

## Configure

Create a local environment file with your API key:

```bash
VEO_API_KEY=your_key_here
VEO_MODEL=veo-2.0-generate-001
```

Google Cloud authentication must also be available if Veo returns `gs://` video URIs, because segment download uses `@google-cloud/storage`.

## Run

```bash
npx ts-node src/index.ts "a cinematic product launch for an AI content engine"
```

You can also use the package script:

```bash
npm run video -- "a cinematic product launch for an AI content engine"
```

## Expected Output

The command logs the generated `VideoScript` JSON, submits up to two Veo jobs at a time, downloads ordered scene files into `segments/`, writes an ffmpeg concat list into `output/concat.txt`, and produces the final video at:

```bash
output/Cinematic <Topic>.mp4
```

It also writes a browser page with a video player and direct MP4 download button:

```bash
output/index.html
```

Typecheck the pipeline with:

```bash
npm run typecheck:video
```
