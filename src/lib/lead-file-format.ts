export function leadFileFormat(bytes: Uint8Array, mime: string): "pdf" | "office" | "image" | "text" {
  const signature = new TextDecoder().decode(bytes.subarray(0, 8));
  if (signature.startsWith("%PDF-")) return "pdf";
  if (bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4) return "office";
  if ((bytes[0] === 255 && bytes[1] === 216) || (bytes[0] === 137 && signature.slice(1, 4) === "PNG") || signature.startsWith("GIF8") || (signature.startsWith("RIFF") && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP")) return "image";
  if (bytes[0] === 208 && bytes[1] === 207) throw new Error("Legacy DOC/XLS: save as DOCX/XLSX or PDF first");
  const text = new TextDecoder().decode(bytes);
  if (text.includes("\u0000") || text.includes("\ufffd") || /[\u0001-\u0008\u000e-\u001f]/.test(text)) throw new Error("Unsupported binary file — use CSV, TXT, JSON, DOCX, XLSX, PPTX, PDF or an image");
  if (mime.startsWith("audio/") || mime.startsWith("video/")) throw new Error("Audio/video lead import is not supported");
  return "text";
}

export function imageContentMime(bytes: Uint8Array): string {
  if (bytes[0] === 255) return "image/jpeg";
  if (bytes[0] === 137) return "image/png";
  if (bytes[0] === 71) return "image/gif";
  return "image/webp";
}