# Requirements Document

## Introduction

This document specifies the requirements for a unified media storage abstraction layer supporting multiple cloud storage providers. The feature enables users to paste and upload various media types (images, documents, etc.) into chat conversations with configurable backend storage.

The system supports two primary storage providers:
1. **Cloudinary**: Optimized for images with built-in transformations, CDN delivery, and automatic format optimization
2. **S3-compatible storage**: Including Cloudflare R2, Backblaze B2, and AWS S3 for cost-effective object storage

A provider abstraction layer (`MediaStorageProvider`) ensures consistent behavior regardless of the underlying storage backend. Providers can be switched via environment configuration without code changes. Media files are parsed using the anydoc library for enhanced document extraction, and content is sent to the AI along with media URLs for context-aware responses.

The integration replaces the current local file storage approach with a cloud-based solution that provides better scalability, reliability, and CDN-backed delivery. The architecture allows switching between providers based on cost optimization, feature requirements, or business needs.

## Glossary

- **MediaStorageProvider**: Abstract base interface defining upload, retrieval, deletion, and URL generation operations for media storage
- **CloudinaryMediaStorage**: Concrete implementation of MediaStorageProvider using Cloudinary as the backend
- **S3MediaStorage**: Concrete implementation of MediaStorageProvider using S3-compatible storage (R2, Backblaze B2, AWS S3)
- **StorageProviderFactory**: Factory component that instantiates the correct MediaStorageProvider based on configuration
- **Anydoc_Parser**: The Firecrawl anydoc library that converts office documents (Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, PDF) into clean GitHub-Flavored Markdown
- **Media_Handler**: The component that processes pasted or uploaded media files before chat submission
- **Chat_Service**: The existing service that manages chat threads, messages, and AI interactions
- **Material_Service**: The existing service that manages uploaded study materials, chunking, and embeddings
- **Upload_Validator**: The component that validates file types, sizes, and content before processing
- **Chunk_Generator**: The component that splits parsed document text into semantic chunks for AI context
- **Frontend_Uploader**: The Next.js component that handles file paste, upload UI, and progress tracking
- **Backend_API**: The FastAPI routes that handle media upload, processing, and chat integration
- **Media_URL**: The secure URL pointing to a media file stored in the configured provider (Cloudinary or S3)
- **Parsed_Chunk**: A segment of extracted and normalized text from a document, ready for AI consumption
- **Media_Attachment**: A media file associated with a chat message, containing both the Media_URL and parsed content
- **Access_Control**: Security mechanisms ensuring users can only access their own uploaded media
- **Cost_Optimizer**: Component that manages storage provider resource usage to minimize costs
- **URL_Transformer**: Component responsible for generating optimized, transformed URLs for images (provider-specific)
- **Migration_Tool**: Utility for switching between storage providers and migrating existing media

## Requirements

### Requirement 1: Media Storage Provider Abstraction

**User Story:** As a developer, I want a unified storage provider interface, so that the application can switch between Cloudinary and S3-compatible storage without code changes.

#### Acceptance Criteria

1. THE MediaStorageProvider SHALL define an abstract interface with methods: upload, get_url, delete, exists, transform_url
2. THE MediaStorageProvider SHALL accept configuration parameters: provider credentials, bucket/cloud names, region settings
3. THE CloudinaryMediaStorage SHALL implement MediaStorageProvider using the Cloudinary Python SDK
4. THE S3MediaStorage SHALL implement MediaStorageProvider using boto3 and S3-compatible APIs
5. THE StorageProviderFactory SHALL instantiate the correct provider based on the MEDIA_STORAGE_PROVIDER environment variable
6. WHERE MEDIA_STORAGE_PROVIDER="cloudinary", THE StorageProviderFactory SHALL return a CloudinaryMediaStorage instance
7. WHERE MEDIA_STORAGE_PROVIDER="s3", THE StorageProviderFactory SHALL return an S3MediaStorage instance
8. IF MEDIA_STORAGE_PROVIDER is unset or invalid, THEN THE Backend_API SHALL default to S3 storage and log a warning

### Requirement 2: Cloudinary Provider Implementation

**User Story:** As a developer, I want a Cloudinary storage provider implementation, so that I can leverage Cloudinary's image transformation and CDN features.

#### Acceptance Criteria

1. THE CloudinaryMediaStorage SHALL install and configure the Cloudinary Python SDK
2. THE CloudinaryMediaStorage SHALL authenticate using environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
3. WHEN the CloudinaryMediaStorage is instantiated, it SHALL validate the credentials
4. THE CloudinaryMediaStorage.upload SHALL upload files to Cloudinary and return a unique resource identifier
5. THE CloudinaryMediaStorage.get_url SHALL return secure HTTPS URLs for uploaded media
6. THE CloudinaryMediaStorage.delete SHALL remove media from Cloudinary by resource identifier
7. THE CloudinaryMediaStorage.exists SHALL check if a resource exists in Cloudinary
8. THE CloudinaryMediaStorage.transform_url SHALL apply Cloudinary transformations via URL parameters (quality, format, width, height, crop)

### Requirement 3: S3-Compatible Provider Implementation

**User Story:** As a developer, I want an S3-compatible storage provider implementation, so that I can use cost-effective object storage like R2, Backblaze B2, or AWS S3.

#### Acceptance Criteria

1. THE S3MediaStorage SHALL use boto3 to interact with S3-compatible APIs
2. THE S3MediaStorage SHALL authenticate using environment variables: S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_BUCKET_NAME
3. THE S3MediaStorage SHALL support AWS S3, Cloudflare R2, and Backblaze B2 by configuring the appropriate endpoint URL
4. THE S3MediaStorage.upload SHALL upload files to the configured bucket with optional content-type metadata
5. THE S3MediaStorage.get_url SHALL generate presigned URLs with configurable expiration times (default: 1 hour)
6. THE S3MediaStorage.delete SHALL remove objects from the S3 bucket by key
7. THE S3MediaStorage.exists SHALL check if an object exists in the bucket using HEAD requests
8. THE S3MediaStorage.transform_url SHALL return the base presigned URL (no transformation support for S3 providers)
9. WHERE S3_ENDPOINT_URL is not set, THE S3MediaStorage SHALL default to AWS S3 endpoints

### Requirement 4: Anydoc Parser Integration

**User Story:** As a developer, I want to integrate the anydoc parser library, so that document parsing quality improves beyond the current extraction implementation.

#### Acceptance Criteria

1. THE Backend_API SHALL install the firecrawl-anydoc Python package
2. THE Anydoc_Parser SHALL parse documents using the `anydoc.to_markdown_bytes()` function
3. WHEN a supported document format is uploaded, THE Anydoc_Parser SHALL extract clean GitHub-Flavored Markdown
4. THE Anydoc_Parser SHALL support all formats: .doc, .docx, .docm, .ppt, .pps, .pot, .pptx, .pptm, .ppsx, .ppsm, .xls, .xlsx, .xlsm, .xlsb, .odt, .ods, .odp, .rtf, .epub, .csv, .pdf
5. WHERE anydoc fails to parse a document, THE Backend_API SHALL fallback to the existing extraction service
6. THE Anydoc_Parser SHALL preserve document structure including headings, tables, lists, code blocks, and links
7. THE Anydoc_Parser SHALL extract embedded images and include alt text in the Markdown output

### Requirement 5: Frontend Paste Handling

**User Story:** As a user, I want to paste media files directly into the chat input, so that I can quickly share documents and images without manual file selection.

#### Acceptance Criteria

1. WHEN a user pastes content into the chat input, THE Frontend_Uploader SHALL detect if the clipboard contains file data
2. THE Frontend_Uploader SHALL extract files from paste events using the Clipboard API
3. WHERE multiple files are pasted, THE Frontend_Uploader SHALL queue all files for upload
4. THE Frontend_Uploader SHALL display a preview thumbnail for image files
5. THE Frontend_Uploader SHALL display a file icon and name for non-image files
6. THE Frontend_Uploader SHALL allow users to remove pasted files before sending the message
7. WHEN a file is pasted, THE Frontend_Uploader SHALL validate the file type before queuing

### Requirement 6: File Type Validation

**User Story:** As a user, I want the system to validate uploaded files, so that I only upload supported media types.

#### Acceptance Criteria

1. THE Upload_Validator SHALL accept image formats: .jpg, .jpeg, .png, .gif, .webp, .bmp, .svg
2. THE Upload_Validator SHALL accept document formats: .pdf, .doc, .docx, .docm, .ppt, .pps, .pot, .pptx, .pptm, .ppsx, .ppsm, .xls, .xlsx, .xlsm, .xlsb, .odt, .ods, .odp, .rtf, .epub, .csv, .txt, .md, .markdown
3. WHEN an unsupported file type is uploaded, THE Upload_Validator SHALL reject the file and return a descriptive error message
4. THE Upload_Validator SHALL validate file types using both MIME type and file extension
5. THE Upload_Validator SHALL detect mismatched file extensions and MIME types
6. WHERE a file has no extension, THE Upload_Validator SHALL rely on MIME type detection from file content
7. THE Upload_Validator SHALL enforce a maximum file size of 25 MB per file

### Requirement 7: Provider-Agnostic Media Upload

**User Story:** As a user, I want my media files uploaded to the configured storage provider, so that they are stored securely and delivered efficiently.

#### Acceptance Criteria

1. WHEN a user submits a chat message with media attachments, THE Backend_API SHALL upload each file using the configured MediaStorageProvider
2. THE MediaStorageProvider SHALL generate a unique storage path for each user: `{provider_prefix}/{user_id}/{timestamp}/{filename}`
3. THE MediaStorageProvider SHALL preserve the original filename during upload
4. WHEN upload is successful, THE MediaStorageProvider SHALL return a unique resource identifier or storage key
5. IF upload fails, THEN THE Backend_API SHALL return a descriptive error to the frontend
6. THE MediaStorageProvider SHALL tag uploaded files with metadata: user_id, upload_date, thread_id
7. WHERE the provider is CloudinaryMediaStorage, it SHALL apply transformation presets for image optimization (quality: auto, fetch format: auto)
8. WHERE the provider is S3MediaStorage, it SHALL set appropriate content-type headers for proper browser rendering

### Requirement 8: Document Parsing with Anydoc

**User Story:** As a user, I want uploaded documents to be parsed accurately, so that the AI can understand their content.

#### Acceptance Criteria

1. WHEN a document file is uploaded, THE Backend_API SHALL parse it using the Anydoc_Parser
2. THE Anydoc_Parser SHALL convert the document to GitHub-Flavored Markdown
3. THE Anydoc_Parser SHALL normalize the extracted Markdown using the existing `normalize_extracted_text()` function
4. WHEN anydoc parsing succeeds, THE Backend_API SHALL use the anydoc output
5. IF anydoc parsing fails, THEN THE Backend_API SHALL fallback to the existing extraction service
6. THE Backend_API SHALL log parsing method used (anydoc or fallback) for monitoring
7. WHEN a CSV file is uploaded, THE Anydoc_Parser SHALL explicitly specify the format as 'csv'

### Requirement 9: Document Chunking

**User Story:** As a developer, I want parsed documents to be chunked appropriately, so that the AI receives manageable context windows.

#### Acceptance Criteria

1. WHEN a document is parsed, THE Chunk_Generator SHALL split the Markdown output into semantic chunks
2. THE Chunk_Generator SHALL use the existing `chunk_text()` function with default parameters (max_chars=1400, overlap=150, min_chars=220)
3. THE Chunk_Generator SHALL preserve chunk boundaries at paragraph and sentence breaks
4. THE Chunk_Generator SHALL apply overlap between consecutive chunks for context continuity
5. WHERE a document produces no valid chunks, THE Backend_API SHALL return an error to the user
6. THE Chunk_Generator SHALL include chunk metadata: chunk_index, total_chunks, source_filename

### Requirement 10: Chat Message with Media Attachments

**User Story:** As a user, I want to send chat messages with media attachments, so that the AI can reference my uploaded content.

#### Acceptance Criteria

1. WHEN a user sends a message with media attachments, THE Chat_Service SHALL process both text and media
2. THE Backend_API SHALL accept multipart/form-data requests containing text content and file uploads
3. THE Chat_Service SHALL upload all media files using the configured MediaStorageProvider before generating the AI response
4. THE Chat_Service SHALL parse document files using the Anydoc_Parser
5. THE Chat_Service SHALL chunk parsed documents using the Chunk_Generator
6. THE Chat_Service SHALL construct an AI prompt containing: user message text, Media URLs, and parsed document chunks
7. THE Chat_Service SHALL store Media_Attachment records in the database linking to the chat message

### Requirement 11: AI Context Integration

**User Story:** As a user, I want the AI to reference my uploaded media in its responses, so that I get context-aware answers.

#### Acceptance Criteria

1. WHEN generating an AI response, THE Chat_Service SHALL include Media URLs in the prompt
2. THE Chat_Service SHALL include parsed document chunks in the prompt with clear delimiters
3. THE Chat_Service SHALL format image URLs as: `[Image: filename](media_url)`
4. THE Chat_Service SHALL format document chunks as: `--- Document: filename (chunk X of Y) ---\n{content}\n---`
5. THE Chat_Service SHALL limit total context size to stay within the AI model's token limit
6. WHERE document chunks exceed token limits, THE Chat_Service SHALL select the most relevant chunks based on the user's query
7. THE Chat_Service SHALL preserve chunk order when including them in the AI prompt

### Requirement 12: Media Attachment Storage

**User Story:** As a developer, I want media attachments stored in the database, so that chat history includes references to uploaded files.

#### Acceptance Criteria

1. THE Backend_API SHALL create a new database table `media_attachments` with columns: id, message_id, user_id, storage_provider, resource_key, media_url, filename, file_type, file_size, parsed_content, chunk_count, created_at
2. WHEN a media file is uploaded, THE Backend_API SHALL create a Media_Attachment record
3. THE Media_Attachment SHALL store the storage_provider type ("cloudinary" or "s3")
4. THE Media_Attachment SHALL store the resource_key (provider-specific identifier)
5. THE Media_Attachment SHALL store the media_url for direct access
6. THE Media_Attachment SHALL store parsed content for search and retrieval
7. THE Media_Attachment SHALL reference the chat message it belongs to via message_id
8. THE Backend_API SHALL support querying media attachments by message_id, user_id, or thread_id

### Requirement 13: Frontend Upload Progress

**User Story:** As a user, I want to see upload progress for my media files, so that I know when uploads are complete.

#### Acceptance Criteria

1. WHEN files are being uploaded, THE Frontend_Uploader SHALL display a progress indicator for each file
2. THE Frontend_Uploader SHALL show percentage progress for each file upload
3. WHEN all uploads complete successfully, THE Frontend_Uploader SHALL enable the send message button
4. IF any upload fails, THEN THE Frontend_Uploader SHALL display an error message and allow retry
5. THE Frontend_Uploader SHALL disable the send button while uploads are in progress
6. THE Frontend_Uploader SHALL display upload speed and estimated time remaining

### Requirement 14: Access Control and Security

**User Story:** As a user, I want my uploaded media to be secure, so that only I can access my files.

#### Acceptance Criteria

1. THE Access_Control SHALL verify that users can only upload media to their own threads
2. THE Access_Control SHALL verify that users can only access media they uploaded or media in their accessible threads
3. THE MediaStorageProvider SHALL generate signed URLs with expiration for sensitive documents
4. THE Backend_API SHALL validate user ownership before returning Media URLs
5. WHEN a user requests a media file, THE Access_Control SHALL verify thread access permissions
6. THE MediaStorageProvider SHALL use secure HTTPS URLs for all media delivery
7. THE Backend_API SHALL sanitize filenames to prevent path traversal attacks
8. WHERE the provider is S3MediaStorage, it SHALL generate presigned URLs with configurable expiration (default: 1 hour)

### Requirement 15: Error Handling and Resilience

**User Story:** As a user, I want clear error messages when uploads fail, so that I can take corrective action.

#### Acceptance Criteria

1. WHEN MediaStorageProvider upload fails, THE Backend_API SHALL return a user-friendly error message
2. WHEN anydoc parsing fails, THE Backend_API SHALL fallback to the existing parser and log the failure
3. WHEN file validation fails, THE Upload_Validator SHALL return a specific error indicating the validation rule violated
4. WHEN network errors occur during upload, THE Frontend_Uploader SHALL display a retry option
5. THE Backend_API SHALL handle provider rate limits gracefully and queue uploads if necessary
6. THE Backend_API SHALL log all upload errors with context: user_id, filename, provider, error_type, timestamp
7. WHERE the configured MediaStorageProvider is unavailable, THE Backend_API SHALL return a service unavailable error to the frontend

### Requirement 16: Cost Optimization

**User Story:** As a platform administrator, I want to optimize storage provider usage costs, so that the service remains economically sustainable.

#### Acceptance Criteria

1. WHERE the provider is CloudinaryMediaStorage, THE Cost_Optimizer SHALL apply automatic quality and format transformations to reduce storage size
2. WHERE the provider is CloudinaryMediaStorage, THE Cost_Optimizer SHALL use the `auto` quality and `auto` fetch format settings
3. WHERE the provider is S3MediaStorage, THE Cost_Optimizer SHALL leverage provider-specific cost optimizations (e.g., R2's free egress, B2's lifecycle policies)
4. THE Cost_Optimizer SHALL enforce file size limits to prevent excessive storage costs
5. THE Backend_API SHALL delete provider resources when associated chat messages are deleted
6. THE Cost_Optimizer SHALL implement a retention policy to delete media older than 180 days for inactive threads
7. THE Backend_API SHALL log provider API usage for cost monitoring

### Requirement 17: Migration from Local Storage

**User Story:** As a developer, I want to migrate from local file storage to cloud providers, so that existing materials can leverage the new infrastructure.

#### Acceptance Criteria

1. THE Material_Service SHALL continue to support local file storage for existing materials
2. THE Backend_API SHALL create a migration script to upload existing local files to the configured MediaStorageProvider
3. THE migration script SHALL update Material records with provider URLs after successful upload
4. THE migration script SHALL preserve original filenames and metadata during migration
5. WHERE migration fails for a file, THE migration script SHALL log the error and continue processing other files
6. THE Material_Service SHALL support reading files from local storage, S3, and Cloudinary during the transition period
7. THE migration script SHALL provide a dry-run mode to preview changes without modifying data

### Requirement 18: Provider-Specific URL Generation and Transformation

**User Story:** As a developer, I want optimized URL generation for each provider, so that media files are delivered efficiently with provider-appropriate transformations.

#### Acceptance Criteria

1. THE MediaStorageProvider SHALL generate secure HTTPS URLs for all uploaded media
2. WHERE the provider is CloudinaryMediaStorage, THE URL_Transformer SHALL apply transformations via URL parameters: quality, format, width, height, crop
3. WHERE the provider is CloudinaryMediaStorage, THE URL_Transformer SHALL generate thumbnail URLs with transformations: `w_200,h_200,c_fill,q_auto,f_auto`
4. WHERE the provider is CloudinaryMediaStorage, THE URL_Transformer SHALL generate preview URLs with transformations: `w_800,h_800,c_limit,q_auto,f_auto`
5. WHERE the provider is S3MediaStorage, THE URL_Transformer SHALL generate presigned URLs with configurable expiration
6. WHERE the provider is S3MediaStorage, THE URL_Transformer SHALL return base URLs without transformation parameters
7. THE URL_Transformer SHALL cache generated URLs to avoid repeated API calls
8. THE Backend_API SHALL provide a consistent URL generation interface regardless of the underlying provider

### Requirement 19: Frontend Media Preview

**User Story:** As a user, I want to see previews of media in chat messages, so that I can verify the content before sending.

#### Acceptance Criteria

1. WHEN an image is attached, THE Frontend_Uploader SHALL display a thumbnail preview
2. WHEN a document is attached, THE Frontend_Uploader SHALL display a document icon and filename
3. THE Frontend_Uploader SHALL show file size and type for each attachment
4. THE Frontend_Uploader SHALL allow users to remove attachments by clicking a remove button
5. WHEN images load, THE Frontend_Uploader SHALL display them using optimized thumbnail URLs
6. THE Frontend_Uploader SHALL display a loading state while generating previews

### Requirement 20: Existing Material Compatibility

**User Story:** As a developer, I want the new media storage to coexist with existing materials, so that no functionality is lost during migration.

#### Acceptance Criteria

1. THE Material_Service SHALL detect storage type based on the storage_path prefix or metadata field
2. THE Material_Service SHALL generate download URLs for cloud-stored materials using the appropriate MediaStorageProvider
3. THE Material_Service SHALL continue generating presigned URLs for locally-stored materials during transition
4. THE Chat_Service SHALL support attaching both new cloud media and existing materials to messages
5. THE Backend_API SHALL support querying attachments across all storage types (local, S3, Cloudinary)
6. THE Material_Service SHALL support reprocessing materials from any storage type

### Requirement 21: Streaming Upload for Large Files

**User Story:** As a user, I want to upload large documents efficiently, so that uploads don't time out or consume excessive memory.

#### Acceptance Criteria

1. THE Backend_API SHALL support streaming uploads for files larger than 5 MB
2. THE Cloudinary_Service SHALL upload files in chunks to avoid memory exhaustion
3. WHEN a large file is uploaded, THE Backend_API SHALL stream the file directly to Cloudinary without buffering entirely in memory
4. THE Backend_API SHALL support resumable uploads for files larger than 10 MB
5. THE Frontend_Uploader SHALL chunk large files and upload them in parallel when supported by the backend
6. THE Backend_API SHALL validate chunk integrity before finalizing the upload

### Requirement 22: Anydoc Parser Fallback Strategy

**User Story:** As a developer, I want a robust fallback strategy for document parsing, so that parsing always succeeds with best-effort results.

#### Acceptance Criteria

1. THE Backend_API SHALL attempt anydoc parsing first for all supported document formats
2. WHERE anydoc parsing fails with a `ConvertError`, THE Backend_API SHALL fallback to the existing extraction service
3. THE Backend_API SHALL log parsing failures with error details: filename, format, error_type, error_message
4. WHERE both anydoc and fallback parsing fail, THE Backend_API SHALL return a user-friendly error message
5. THE Backend_API SHALL track parsing success rates by format for monitoring
6. THE Backend_API SHALL include a parsing_method field in Media_Attachment records: "anydoc", "fallback", or "failed"

### Requirement 23: Provider Switching and Configuration

**User Story:** As a platform administrator, I want to switch storage providers via configuration, so that I can optimize costs and features without code changes.

#### Acceptance Criteria

1. THE Backend_API SHALL read the MEDIA_STORAGE_PROVIDER environment variable on startup
2. THE StorageProviderFactory SHALL validate the provider value is one of: "cloudinary", "s3"
3. WHERE MEDIA_STORAGE_PROVIDER is "cloudinary", THE Backend_API SHALL require environment variables: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
4. WHERE MEDIA_STORAGE_PROVIDER is "s3", THE Backend_API SHALL require environment variables: S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_BUCKET_NAME
5. IF required credentials are missing, THEN THE Backend_API SHALL log an error and fail to start
6. THE Backend_API SHALL log the active storage provider on startup
7. THE Backend_API SHALL support hot-reloading provider configuration without restarting the application

### Requirement 24: Cross-Provider Migration Tool

**User Story:** As a platform administrator, I want to migrate media between storage providers, so that I can switch providers without losing existing media.

#### Acceptance Criteria

1. THE Migration_Tool SHALL provide a CLI command to migrate media between providers
2. THE Migration_Tool SHALL accept source and destination provider configurations
3. WHEN migrating media, THE Migration_Tool SHALL download from the source provider and upload to the destination provider
4. THE Migration_Tool SHALL update Media_Attachment records with new storage_provider and resource_key values
5. THE Migration_Tool SHALL preserve all metadata during migration: filename, file_type, file_size, parsed_content
6. WHERE migration fails for a file, THE Migration_Tool SHALL log the error and continue with remaining files
7. THE Migration_Tool SHALL provide progress reporting: files processed, files remaining, success rate
8. THE Migration_Tool SHALL support filtering by date range, user_id, or thread_id
9. THE Migration_Tool SHALL provide a dry-run mode to preview changes without modifying data

### Requirement 25: Provider Feature Detection

**User Story:** As a developer, I want to detect provider capabilities at runtime, so that I can provide appropriate UI features and optimizations.

#### Acceptance Criteria

1. THE MediaStorageProvider SHALL expose a capabilities interface with flags: supports_transformations, supports_signed_urls, supports_streaming
2. WHERE the provider is CloudinaryMediaStorage, it SHALL report: supports_transformations=true, supports_signed_urls=true, supports_streaming=false
3. WHERE the provider is S3MediaStorage, it SHALL report: supports_transformations=false, supports_signed_urls=true, supports_streaming=true
4. THE Frontend_Uploader SHALL query provider capabilities and adjust UI accordingly
5. WHERE transformations are not supported, THE Frontend_Uploader SHALL disable transformation options in the UI
6. THE Backend_API SHALL expose a `/api/storage/capabilities` endpoint returning provider capabilities
7. THE Backend_API SHALL cache capabilities information to avoid repeated checks

### Requirement 26: Migration Documentation

**User Story:** As a platform administrator, I want comprehensive migration documentation, so that I can confidently switch between storage providers.

#### Acceptance Criteria

1. THE Backend_API repository SHALL include a STORAGE_MIGRATION.md document
2. THE migration guide SHALL document environment variables for each provider
3. THE migration guide SHALL provide step-by-step instructions for switching from Cloudinary to S3 and vice versa
4. THE migration guide SHALL document cost comparison between providers
5. THE migration guide SHALL document feature differences between providers
6. THE migration guide SHALL provide example configurations for common S3-compatible providers: AWS S3, Cloudflare R2, Backblaze B2
7. THE migration guide SHALL document rollback procedures if migration fails
