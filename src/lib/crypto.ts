import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for sensitive fields. Stored format: v1:<iv>:<tag>:<ciphertext> (base64 parts).

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function encryptOptional(plain: string | null | undefined): string | null {
  return plain ? encrypt(plain) : null;
}

export function decryptOptional(stored: string | null | undefined): string | null {
  return stored ? decrypt(stored) : null;
}

/** Encrypt a file's bytes: [12-byte IV][16-byte tag][ciphertext]. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptBuffer(stored: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), stored.subarray(0, 12));
  decipher.setAuthTag(stored.subarray(12, 28));
  return Buffer.concat([decipher.update(stored.subarray(28)), decipher.final()]);
}

export function encryptJson(value: unknown): string {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(stored: string | null | undefined): T | null {
  return stored ? (JSON.parse(decrypt(stored)) as T) : null;
}
