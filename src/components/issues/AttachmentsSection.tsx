"use client";

import React, { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Attachment } from "@/types";
import { uploadAttachment, deleteAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_SIZE, formatFileSize, isPreviewableImageMime } from "@/lib/attachments";
import UserAvatar from "@/components/common/UserAvatar";
import { Upload, Download, Trash2, FileText, Loader2 } from "lucide-react";
import SectionHeader, { SectionAction } from "./SectionHeader";
import { Tooltip } from "@/components/ui/Popover";

interface AttachmentsSectionProps {
  issueId: string;
  attachments?: Attachment[];
  canUpload: boolean;
  canDelete: (attachment: Attachment) => boolean;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentRemoved: (attachmentId: string) => void;
}

function attachmentUrl(id: string): string {
  return `/api/v1/attachments/${id}`;
}

function AttachmentTile({
  attachment,
  canRemove,
  deleting,
  onDelete,
}: {
  attachment: Attachment;
  canRemove: boolean;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const previewable = isPreviewableImageMime(attachment.mimeType);
  const url = attachmentUrl(attachment.id);

  return (
    <div className="group relative flex flex-col rounded-md border border-subtle bg-surface overflow-hidden hover:border-subtle transition-colors">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-20 bg-page border-b border-subtle overflow-hidden"
        aria-label={`Open ${attachment.fileName}`}
      >
        {previewable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.fileName} className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-7 h-7 text-muted" aria-hidden="true" />
        )}
      </a>

      <div className="p-2 flex flex-col gap-1 min-w-0">
        <Tooltip content={attachment.fileName}>
          <span className="text-[11px] font-medium text-ink truncate">{attachment.fileName}</span>
        </Tooltip>
        <span className="text-[10px] text-muted">{formatFileSize(attachment.size)}</span>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          <UserAvatar user={attachment.uploadedBy} size="xs" />
          <span className="truncate">{attachment.uploadedBy.name}</span>
        </div>
        <span className="text-[10px] text-muted">
          {formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Tooltip content="Download">
          <a
            href={url}
            download={attachment.fileName}
            aria-label={`Download ${attachment.fileName}`}
            className="p-1 rounded bg-surface/90 text-ink-2 hover:text-accent border border-subtle shadow-xs"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
          </a>
        </Tooltip>
        {canRemove && (
          <Tooltip content="Delete">
            <button
              type="button"
              onClick={() => onDelete(attachment.id)}
              disabled={deleting}
              aria-label={`Delete ${attachment.fileName}`}
              className="p-1 rounded bg-surface/90 text-ink-2 hover:text-danger border border-subtle shadow-xs disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Trash2 className="w-3 h-3" aria-hidden="true" />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default function AttachmentsSection({
  issueId,
  attachments = [],
  canUpload,
  canDelete,
  onAttachmentAdded,
  onAttachmentRemoved,
}: AttachmentsSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`"${file.name}" is too large. Maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`);
        continue;
      }
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadAttachment(issueId, formData);
      setUploading(false);
      if (res.success && res.attachment) {
        onAttachmentAdded(res.attachment as unknown as Attachment);
      } else {
        setError((res as { error?: string }).error || `Failed to upload "${file.name}".`);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUpload) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId);
    setError(null);
    const res = await deleteAttachment(attachmentId);
    setDeletingId(null);
    if (res.success) {
      onAttachmentRemoved(attachmentId);
    } else {
      setError((res as { error?: string }).error || "Failed to delete attachment.");
    }
  };

  if (attachments.length === 0 && !canUpload) return null;

  return (
    <div
      onDragOver={
        canUpload && attachments.length === 0
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={canUpload && attachments.length === 0 ? () => setDragOver(false) : undefined}
      onDrop={canUpload && attachments.length === 0 ? handleDrop : undefined}
      className={attachments.length === 0 && dragOver ? "rounded-control bg-accent-soft outline-dashed outline-1 outline-accent" : undefined}
    >
      <SectionHeader title="Attachments" count={attachments.length} className="mb-1">
        {canUpload && (
          <SectionAction
            icon={uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Add files
          </SectionAction>
        )}
        {canUpload && <input ref={inputRef} type="file" multiple hidden onChange={handleFileInput} />}
      </SectionHeader>

      {error && (
        <p role="alert" className="mb-2 text-xs text-danger">
          {error}
        </p>
      )}

      {canUpload && attachments.length > 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-control border border-dashed p-2 transition-colors ${
            dragOver ? "border-accent bg-accent-soft" : "border-strong"
          }`}
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {attachments.map((attachment) => (
              <AttachmentTile
                key={attachment.id}
                attachment={attachment}
                canRemove={canDelete(attachment)}
                deleting={deletingId === attachment.id}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {!canUpload && attachments.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              canRemove={canDelete(attachment)}
              deleting={deletingId === attachment.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
