import bcrypt from "bcrypt";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SALT_ROUNDS = 12;

export const crypto = {
  hash: (password: string) => bcrypt.hash(password, SALT_ROUNDS),
  compare: (password: string, hash: string) => bcrypt.compare(password, hash),
};

// ── Field-level encryption (AES-256-GCM) ─────────────────────────────────────
// Used for sensitive PII columns (e.g. person numbers on contracts).
// Values are stored as "enc:v1:<iv>:<authTag>:<ciphertext>" (base64 parts), so
// legacy plaintext rows can be detected and passed through by decryptField.

const ENC_PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;
function getFieldKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY (or SESSION_SECRET) environment variable is required for field encryption");
  }
  cachedKey = scryptSync(secret, "motio-field-encryption-v1", 32);
  return cachedKey;
}

export function encryptField(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getFieldKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptField(value: string): string {
  // Legacy plaintext rows (written before encryption existed) pass through
  if (!value.startsWith(ENC_PREFIX)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(ENC_PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", getFieldKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
