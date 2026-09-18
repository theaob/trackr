import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_SIZE,
  formatFileSize,
  isPreviewableImageMime,
  sanitizeFileName,
} from "@/lib/attachments";

describe("isPreviewableImageMime", () => {
  it("allows the vetted image types", () => {
    expect(isPreviewableImageMime("image/png")).toBe(true);
    expect(isPreviewableImageMime("image/jpeg")).toBe(true);
    expect(isPreviewableImageMime("image/gif")).toBe(true);
    expect(isPreviewableImageMime("image/webp")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPreviewableImageMime("IMAGE/PNG")).toBe(true);
  });

  it("rejects types that could execute in the browser", () => {
    expect(isPreviewableImageMime("text/html")).toBe(false);
    expect(isPreviewableImageMime("image/svg+xml")).toBe(false);
    expect(isPreviewableImageMime("application/xhtml+xml")).toBe(false);
    expect(isPreviewableImageMime("application/pdf")).toBe(false);
  });

  it("rejects an empty or unknown type", () => {
    expect(isPreviewableImageMime("")).toBe(false);
    expect(isPreviewableImageMime("application/octet-stream")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("passes through an ordinary name", () => {
    expect(sanitizeFileName("report.pdf")).toBe("report.pdf");
  });

  it("strips path separators so the name can't smuggle a path", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeFileName("C:\\Windows\\evil.exe")).toBe("C:_Windows_evil.exe");
  });

  it("strips control characters, including ones that could break a header", () => {
    expect(sanitizeFileName('evil"\r\nX-Injected: true')).toBe('evil"X-Injected: true');
  });

  it("falls back to a default name when nothing is left", () => {
    expect(sanitizeFileName("")).toBe("attachment");
    expect(sanitizeFileName("   ")).toBe("attachment");
  });

  it("truncates an unreasonably long name", () => {
    const long = "a".repeat(500) + ".txt";
    const result = sanitizeFileName(long);
    expect(result.length).toBe(200);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes and megabytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
  });

  it("rounds to a whole number once the value reaches double digits", () => {
    expect(formatFileSize(15.4 * 1024)).toBe("15 KB");
  });

  it("handles the configured max attachment size", () => {
    expect(formatFileSize(MAX_ATTACHMENT_SIZE)).toBe("25 MB");
  });

  it("treats negative or non-finite input as zero", () => {
    expect(formatFileSize(-5)).toBe("0 B");
    expect(formatFileSize(NaN)).toBe("0 B");
  });
});
