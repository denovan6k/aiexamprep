---
title: Media storage
description: Configure local, Cloudinary, or S3-compatible storage for chat media.
---

# Media storage

Chat media is stored through the provider selected by `MEDIA_STORAGE_PROVIDER`.

Uploads are limited to **25 MB** and support common images plus PDF, DOCX, PPTX, XLSX, TXT, Markdown, and CSV. Documents are converted to text with Anydoc when available and fall back to the existing extractor.

## Local development

Default: `MEDIA_STORAGE_PROVIDER=local`.

Files are written under `UPLOAD_DIR` (default `uploads`) and served from `PUBLIC_UPLOAD_BASE_URL` (default `/uploads`). Local installs can use chat uploads without cloud credentials.

## Cloudinary

```env
MEDIA_STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

Cloudinary supplies signed delivery URLs and transformed image thumbnails.

## S3-compatible storage

```env
MEDIA_STORAGE_PROVIDER=s3
MEDIA_S3_BUCKET=knorvex-media
S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto
```

`MEDIA_S3_BUCKET` is preferred for new deployments; existing `S3_*` variables remain supported. AWS S3 can omit `S3_ENDPOINT_URL`; Cloudflare R2 and Backblaze B2 require their compatible endpoint. S3 URLs are short-lived presigned URLs.

## Switching providers

1. Configure the new provider and verify media capabilities via the chat media API.
2. Deploy, upload a test image and document, and confirm the attachment renders in chat.
3. Migrate existing objects before deleting the old bucket/account; attachment rows record provider and storage key.
4. To roll back, restore the prior provider and credentials, then redeploy.

**Guidance:** Cloudinary when image transforms matter; S3-compatible for lower-cost object storage; local for development only.
