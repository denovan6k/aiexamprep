# Multi-Provider Media Storage - Implementation TODO

## Phase 1: Core Infrastructure

### Backend - Storage Abstraction Layer

- [ ] Create `MediaStorageProvider` abstract base class
  - [ ] Define interface methods: `upload()`, `get_url()`, `delete()`, `exists()`
  - [ ] Add support for transformations (resize, crop, quality)
  - [ ] Add support for signed URLs with expiration

- [ ] Implement `CloudinaryMediaStorage` provider
  - [ ] Install cloudinary SDK (`cloudinary>=1.41.0`)
  - [ ] Add config: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - [ ] Implement upload with folder structure: `knorvex/{user_id}/{timestamp}/{filename}`
  - [ ] Implement URL generation with transformations
  - [ ] Implement signed URL generation
  - [ ] Add metadata tagging (user_id, thread_id, upload_date)

- [ ] Implement `S3MediaStorage` provider (R2/Backblaze B2 compatible)
  - [ ] Extend existing `S3StorageBackend` or create new implementation
  - [ ] Add config: `MEDIA_S3_BUCKET`, `MEDIA_S3_ENDPOINT`, `MEDIA_S3_ACCESS_KEY`, `MEDIA_S3_SECRET_KEY`
  - [ ] Implement upload with same folder structure
  - [ ] Implement presigned URL generation
  - [ ] Add optional CDN URL prefix for R2/B2

- [ ] Create `MediaStorageFactory`
  - [ ] Add config: `MEDIA_STORAGE_PROVIDER` (cloudinary|s3)
  - [ ] Factory method to instantiate correct provider
  - [ ] Validate provider config on startup
  - [ ] Log active provider on initialization

- [ ] Add provider configuration to `app/core/config.py`
  - [ ] Cloudinary settings (optional)
  - [ ] S3 media settings (optional)
  - [ ] Provider selection setting
  - [ ] Validation: at least one provider must be configured

### Backend - Anydoc Parser Integration

- [ ] Install anydoc parser
  - [ ] Add `firecrawl-anydoc` to `pyproject.toml`
  - [ ] Run `uv sync` to install

- [ ] Create `AnydocParser` service
  - [ ] Implement `parse_document(file_bytes, format) -> str` (returns Markdown)
  - [ ] Support formats: pdf, docx, pptx, xlsx, odt, rtf, epub, csv
  - [ ] Add fallback to existing extraction service on failure
  - [ ] Log parsing method used (anydoc/fallback)

- [ ] Update extraction service
  - [ ] Try anydoc parser first for supported formats
  - [ ] Fallback to existing `extract_text()` on ConvertError
  - [ ] Track parsing success rate by format

### Backend - Database Schema

- [ ] Create `media_attachments` table migration
  - [ ] Columns: id, message_id, user_id, storage_provider, storage_key, cloudinary_url, filename, file_type, file_size, parsed_content, chunk_count, parsing_method, created_at
  - [ ] Foreign key to messages table
  - [ ] Index on user_id, message_id

- [ ] Create `MediaAttachment` SQLAlchemy model
  - [ ] Add relationship to `ChatMessage`
  - [ ] Add methods: `get_url()`, `get_thumbnail_url()`, `get_preview_url()`

### Backend - Upload API

- [ ] Create `/api/chat/media/upload` endpoint
  - [ ] Accept multipart/form-data with file
  - [ ] Validate file type (images + documents)
  - [ ] Validate file size (max 25MB)
  - [ ] Return: media_id, filename, file_type, file_size, thumbnail_url (for images)

- [ ] Create media service
  - [ ] `upload_media(user_id, file, metadata) -> MediaAttachment`
  - [ ] Sanitize filename (prevent path traversal)
  - [ ] Upload to configured provider
  - [ ] Parse documents if applicable
  - [ ] Chunk parsed documents (reuse existing chunking)
  - [ ] Save to database

- [ ] Add file type validation
  - [ ] Images: jpg, jpeg, png, gif, webp, bmp, svg
  - [ ] Documents: pdf, doc, docx, pptx, xlsx, odt, txt, md, csv
  - [ ] Check MIME type + extension
  - [ ] Reject unsupported formats with clear error

### Backend - Chat Integration

- [ ] Update chat message creation
  - [ ] Accept `media_attachment_ids[]` parameter
  - [ ] Link media attachments to message
  - [ ] Include media URLs and parsed chunks in AI prompt
  - [ ] Format: `[Image: filename](url)` for images
  - [ ] Format: `--- Document: filename (chunk X of Y) ---\n{content}\n---` for docs

- [ ] Update chat message response schema
  - [ ] Include `attachments[]` with media metadata
  - [ ] Include thumbnail URLs for images

- [ ] Add media retrieval endpoint
  - [ ] `/api/chat/media/{media_id}` - Get media metadata
  - [ ] `/api/chat/media/{media_id}/url` - Get access URL (signed/presigned)
  - [ ] Verify user has access (owns media or in accessible thread)

### Backend - Access Control

- [ ] Add permission checks
  - [ ] Users can only upload to their own threads
  - [ ] Users can only access media in their accessible threads
  - [ ] Generate signed/presigned URLs for secure access

- [ ] Add cleanup on message deletion
  - [ ] Delete media from storage provider
  - [ ] Delete media_attachment records

## Phase 2: Frontend

### Frontend - File Upload Component

- [ ] Create `MediaUploader` component
  - [ ] File picker button
  - [ ] Drag & drop support
  - [ ] Paste detection (clipboard API)
  - [ ] Multiple file support
  - [ ] Preview thumbnails (images)
  - [ ] File icons + metadata (documents)

- [ ] Add upload progress tracking
  - [ ] Progress bar per file
  - [ ] Upload speed and ETA
  - [ ] Cancel upload button
  - [ ] Retry on failure

- [ ] Add file management
  - [ ] Remove file before upload
  - [ ] View uploaded files
  - [ ] File size and type display

### Frontend - Chat Integration

- [ ] Update chat input
  - [ ] Integrate MediaUploader component
  - [ ] Attach media to message before send
  - [ ] Show attached media count/preview

- [ ] Update message display
  - [ ] Render image attachments inline
  - [ ] Render document attachments with icon + download link
  - [ ] Show parsing status for documents

- [ ] Add media viewer
  - [ ] Lightbox for images
  - [ ] Download button for documents
  - [ ] Preview for text/markdown

## Phase 3: Documentation & Configuration

### Migration & Configuration Guide

- [ ] Create `MEDIA_STORAGE_GUIDE.md`
  - [ ] Cloudinary setup instructions
  - [ ] S3/R2/B2 setup instructions
  - [ ] Environment variable reference
  - [ ] Provider comparison (cost, features, when to use)
  - [ ] Migration between providers

- [ ] Add configuration examples
  - [ ] `.env.example` updates
  - [ ] Docker compose example (MinIO for local dev)
  - [ ] Railway deployment examples

### Cost Optimization

- [ ] Implement automatic cleanup
  - [ ] Delete media when messages are deleted
  - [ ] Retention policy for old inactive threads (180 days)
  - [ ] Log storage usage for monitoring

- [ ] Add optimization settings
  - [ ] Cloudinary: auto quality, auto format
  - [ ] S3: lifecycle policies (if supported by provider)

## Phase 4: Testing & Validation

### Backend Tests

- [ ] Test provider abstraction
  - [ ] Mock Cloudinary provider
  - [ ] Mock S3 provider
  - [ ] Factory instantiation

- [ ] Test upload flow
  - [ ] File validation
  - [ ] Upload to provider
  - [ ] Database persistence
  - [ ] Document parsing

- [ ] Test access control
  - [ ] Permission checks
  - [ ] URL generation
  - [ ] Signed URL expiration

### Frontend Tests

- [ ] Test file upload component
  - [ ] File selection
  - [ ] Drag & drop
  - [ ] Paste handling
  - [ ] Progress tracking

- [ ] Test chat integration
  - [ ] Attach media to message
  - [ ] Display attachments
  - [ ] Download media

### Integration Tests

- [ ] Test end-to-end flow
  - [ ] Upload image → send message → view in chat
  - [ ] Upload document → parse → send chunks to AI → response
  - [ ] Delete message → cleanup media

## Optional Enhancements (Post-MVP)

- [ ] Image optimization on backend
  - [ ] Add imgproxy for S3 provider (thumbnail generation)
  - [ ] Auto-resize large images before upload

- [ ] Advanced document features
  - [ ] Extract images from PDFs
  - [ ] OCR for scanned documents
  - [ ] Table extraction and formatting

- [ ] Streaming upload for large files
  - [ ] Chunked upload (>5MB)
  - [ ] Resumable uploads (>10MB)
  - [ ] Parallel chunk upload

- [ ] Migration script
  - [ ] Migrate existing materials to media storage
  - [ ] Batch upload script
  - [ ] Dry-run mode

---

## Implementation Order (Recommended)

1. **Backend Storage Layer** (Day 1-2)
   - MediaStorageProvider abstraction
   - CloudinaryMediaStorage implementation
   - S3MediaStorage implementation
   - Factory + config

2. **Backend Anydoc + Upload** (Day 2-3)
   - Anydoc parser integration
   - Upload API endpoint
   - File validation
   - Media service

3. **Backend Chat Integration** (Day 3-4)
   - Database schema + migration
   - Chat message with attachments
   - AI prompt formatting
   - Access control

4. **Frontend Upload UI** (Day 4-5)
   - MediaUploader component
   - Progress tracking
   - File management

5. **Frontend Chat Integration** (Day 5-6)
   - Attach media to messages
   - Display attachments
   - Media viewer

6. **Documentation + Testing** (Day 6-7)
   - Configuration guide
   - Provider switching guide
   - Unit + integration tests
   - End-to-end testing

**Total Estimated Time: 7-10 days for MVP**
