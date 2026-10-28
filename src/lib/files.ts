import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { decryptBuffer, encryptBuffer } from "./crypto";

// Patient files (lab results, signed consent forms) are stored encrypted on disk, outside the web root.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
};

function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

export function validateUpload(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "Empty file";
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 10 MB";
  if (!ALLOWED_TYPES[file.type]) return "Only PDF, JPG, PNG, HEIC or WEBP files";
  return null;
}

export async function saveEncryptedFile(bytes: Buffer): Promise<string> {
  const key = randomBytes(18).toString("base64url");
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), `${key}.bin`), encryptBuffer(bytes), { mode: 0o600 });
  return key;
}

export async function readEncryptedFile(key: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error("Bad storage key");
  return decryptBuffer(await readFile(path.join(uploadDir(), `${key}.bin`)));
}

export async function deleteEncryptedFile(key: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return;
  await unlink(path.join(uploadDir(), `${key}.bin`)).catch(() => {});
}
