"use client";

import {
  Bold,
  Code2,
  Eye,
  Heading2,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Save,
  Upload
} from "lucide-react";
import { useEffect, useState } from "react";

import { Markdown } from "@/components/markdown";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload, FileUploadContent, FileUploadTrigger } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createBlogPost,
  listBlogCategories,
  updateBlogPost,
  uploadBlogImage,
  type BlogCategory,
  type BlogPost,
  type BlogPostInput
} from "@/lib/blog";
import { showError, showSuccess } from "@/lib/toast";

type BlogEditorProps = {
  post?: BlogPost | null;
  onSaved?: (post: BlogPost) => void;
};

export function BlogEditor({ post, onSaved }: BlogEditorProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [categoryId, setCategoryId] = useState(post?.category_id ?? "");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    listBlogCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function buildPayload(): BlogPostInput {
    return {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || undefined,
      content: content.trim(),
      cover_image_url: coverImageUrl.trim() || undefined,
      seo_title: seoTitle.trim() || undefined,
      seo_description: seoDescription.trim() || undefined,
      category_id: categoryId || undefined,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };
  }

  async function handleSave() {
    if (!token || !title.trim() || !content.trim()) return;
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const saved = post
        ? await updateBlogPost(token, post.id, payload)
        : await createBlogPost(token, payload);
      showSuccess(post ? "Post saved." : "Draft created.");
      onSaved?.(saved);
    } catch (err) {
      showError(err, "Failed to save post.");
    } finally {
      setIsSaving(false);
    }
  }

  function insertMarkdown(before: string, after = "", fallback = "") {
    const textarea = document.getElementById("blog-content") as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || fallback;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  function insertBlock(prefix: string, fallback = "") {
    const textarea = document.getElementById("blog-content") as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || fallback;
    const needsLeadingBreak = start > 0 && content[start - 1] !== "\n";
    const block = `${needsLeadingBreak ? "\n" : ""}${selected
      .split("\n")
      .map((line) => `${prefix}${line || fallback}`)
      .join("\n")}`;
    setContent(`${content.slice(0, start)}${block}${content.slice(end)}`);
    requestAnimationFrame(() => textarea?.focus());
  }

  async function handleImageFiles(files: File[], mode: "cover" | "content") {
    const file = files[0];
    if (!token || !file) return;
    setIsUploading(true);
    try {
      const upload = await uploadBlogImage(token, file);
      if (mode === "cover") {
        setCoverImageUrl(upload.url);
      } else {
        insertMarkdown(`![${file.name.replace(/\.[^.]+$/, "") || "Image"}](`, ")", upload.url);
      }
      showSuccess("Image uploaded.");
    } catch (err) {
      showError(err, "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  const toolbar = [
    { label: "Heading", icon: Heading2, action: () => insertBlock("## ", "Heading") },
    { label: "Bold", icon: Bold, action: () => insertMarkdown("**", "**", "bold text") },
    { label: "Italic", icon: Italic, action: () => insertMarkdown("_", "_", "italic text") },
    { label: "Quote", icon: Quote, action: () => insertBlock("> ", "Quote") },
    { label: "Bulleted list", icon: List, action: () => insertBlock("- ", "List item") },
    { label: "Numbered list", icon: ListOrdered, action: () => insertBlock("1. ", "List item") },
    { label: "Code block", icon: Code2, action: () => insertMarkdown("```text\n", "\n```", "code") },
    { label: "Link", icon: LinkIcon, action: () => insertMarkdown("[", "](https://)", "link text") },
    { label: "Image URL", icon: ImageIcon, action: () => insertMarkdown("![Image](", ")", "https://") }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="auto-generated" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={2} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="study, exams, flashcards" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover">Cover image</Label>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            id="cover"
            value={coverImageUrl}
            onChange={(event) => setCoverImageUrl(event.target.value)}
            placeholder="https://..."
          />
          <FileUpload
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple={false}
            disabled={isUploading}
            onFilesAdded={(files) => void handleImageFiles(files, "cover")}
          >
            <FileUploadTrigger asChild>
              <Button type="button" variant="outline" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload
              </Button>
            </FileUploadTrigger>
            <FileUploadContent>
              <div className="rounded-lg border border-dashed border-primary bg-background p-8 text-sm">
                Drop an image to upload
              </div>
            </FileUploadContent>
          </FileUpload>
        </div>
      </div>

      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write" className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
            {toolbar.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.label} type="button" variant="ghost" size="sm" onClick={item.action} title={item.label}>
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{item.label}</span>
                </Button>
              );
            })}
            <FileUpload
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple={false}
              disabled={isUploading}
              onFilesAdded={(files) => void handleImageFiles(files, "content")}
            >
              <FileUploadTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={isUploading} title="Upload and insert image">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="sr-only">Upload and insert image</span>
                </Button>
              </FileUploadTrigger>
              <FileUploadContent>
                <div className="rounded-lg border border-dashed border-primary bg-background p-8 text-sm">
                  Drop an image to insert
                </div>
              </FileUploadContent>
            </FileUpload>
          </div>
          <Textarea
            id="blog-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={18}
            placeholder="Write in Markdown - headings, lists, code blocks, images, tables, and more."
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <div className="min-h-[300px] rounded-lg border border-border bg-muted/20 p-6">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="" className="mb-6 max-h-64 w-full rounded-lg object-cover" />
            ) : null}
            <article className="prose prose-neutral dark:prose-invert max-w-none">
              <h1>{title || "Untitled"}</h1>
              {excerpt ? <p className="lead">{excerpt}</p> : null}
              <Markdown>{content || "*Nothing to preview yet.*"}</Markdown>
            </article>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="seo-title">SEO title</Label>
          <Input id="seo-title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seo-description">SEO description</Label>
          <Input
            id="seo-description"
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={isSaving || isUploading || !title.trim() || !content.trim()}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {post ? "Save changes" : "Create draft"}
        </Button>
        {post?.status ? <Badge variant="outline">{post.status}</Badge> : null}
      </div>
    </div>
  );
}
