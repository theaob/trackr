"use client";

import React, { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Attachment } from "@/types";
import { uploadAttachment, deleteAttachment } from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_SIZE, formatFileSize, isPreviewableImageMime } from "@/lib/attachments";
import UserAvatar from "@/components/common/UserAvatar";
import { Paperclip, Upload, Download, Trash2, FileText, Loader2 } from "lucide-react";

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
    <div className="group relative flex flex-col rounded-md border border-jira-gray-200 bg-white overflow-hidden hover:border-jira-gray-300 transition-colors">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center h-20 bg-jira-gray-50 border-b border-jira-gray-200 overflow-hidden"
        title={attachment.fileName}
      >
        {previewable ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.fileName} className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-7 h-7 text-jira-gray-400" />
        )}
      </a>

      <div className="p-2 flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-medium text-jira-navy truncate" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className="text-[10px] text-jira-gray-500">{formatFileSize(attachment.size)}</span>
        <div className="flex items-center gap-1 text-[10px] text-jira-gray-500">
          <UserAvatar user={attachment.uploadedBy} size="xs" />
          <span className="truncate">{attachment.uploadedBy.name}</span>
        </div>
        <span className="text-[10px] text-jira-gray-400">
          {formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true })}
        </span>
      </div>

      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={url}
          download={attachment.fileName}
          title="Download"
          className="p-1 rounded bg-white/90 text-jira-gray-600 hover:text-jira-blue border border-jira-gray-200 shadow-xs"
        >
          <Download className="w-3 h-3" />
        </a>
        {canRemove && (
          <button
            type="button"
            onClick={() => onDelete(attachment.id)}
            disabled={deleting}
            title="Delete"
            className="p-1 rounded bg-white/90 text-jira-gray-600 hover:text-rose-600 border border-jira-gray-200 shadow-xs disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-jira-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-jira-blue" />
          <span>Attachments{attachments.length > 0 ? ` (${attachments.length})` : ""}</span>
        </h3>
        {canUpload && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-[11px] text-jira-blue hover:underline font-semibold flex items-center gap-1 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Add files
          </button>
        )}
        {canUpload && (
          <input ref={inputRef} type="file" multiple hidden onChange={handleFileInput} />
        )}
      </div>

      {error && <div className="text-[11px] text-rose-600 font-medium mb-2">{error}</div>}

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-md border border-dashed transition-colors ${
            dragOver ? "border-jira-blue bg-jira-blue-subtle/30" : "border-jira-gray-300"
          } ${attachments.length === 0 ? "p-3" : "p-2"}`}
        >
          {attachments.length === 0 ? (
            <p className="text-xs text-jira-gray-500 text-center py-1">
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-jira-blue hover:underline font-medium"
              >
                browse
              </button>
            </p>
          ) : (
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
