import { z } from "zod";
import { db } from "./db";

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const recordSchema = z.record(z.string(), z.unknown());
const payloadSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  profiles: z.array(recordSchema),
  bodyMetrics: z.array(recordSchema),
  meals: z.array(recordSchema),
  mealItems: z.array(recordSchema),
  foodOverrides: z.array(recordSchema),
  settings: z.array(recordSchema)
});

const envelopeSchema = z.object({
  format: z.literal("HD-BACKUP-1"),
  appSchemaVersion: z.literal(1),
  createdAt: z.string(),
  kdf: z.object({
    name: z.literal("PBKDF2"),
    hash: z.literal("SHA-256"),
    iterations: z.literal(ITERATIONS)
  }),
  cipher: z.object({ name: z.literal("AES-GCM"), length: z.literal(256) }),
  salt: z.string(),
  iv: z.string(),
  ciphertext: z.string()
});

export type BackupPayload = z.infer<typeof payloadSchema>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  if (password.length < 8) throw new Error("备份密码至少需要8个字符。");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBufferBytes(salt), iterations },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function readBackupPayload(): Promise<BackupPayload> {
  return payloadSchema.parse({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profiles: await db.profiles.toArray(),
    bodyMetrics: await db.bodyMetrics.toArray(),
    meals: await db.meals.toArray(),
    mealItems: await db.mealItems.toArray(),
    foodOverrides: await db.foodOverrides.toArray(),
    settings: await db.settings.toArray()
  });
}

export async function exportEncryptedBackup(password: string): Promise<string> {
  const payload = await readBackupPayload();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload))
  );

  return JSON.stringify({
    format: "HD-BACKUP-1",
    appSchemaVersion: 1,
    createdAt: payload.exportedAt,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
    cipher: { name: "AES-GCM", length: 256 },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  });
}

export async function decryptBackup(text: string, password: string): Promise<BackupPayload> {
  let rawEnvelope: unknown;
  try {
    rawEnvelope = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效JSON。");
  }
  const envelope = envelopeSchema.parse(rawEnvelope);
  const key = await deriveKey(password, base64ToBytes(envelope.salt), envelope.kdf.iterations);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBufferBytes(base64ToBytes(envelope.iv)) },
      key,
      toArrayBufferBytes(base64ToBytes(envelope.ciphertext))
    );
    return payloadSchema.parse(JSON.parse(decoder.decode(plaintext)));
  } catch {
    throw new Error("密码错误或备份文件已经损坏。");
  }
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  await db.transaction(
    "rw",
    [db.profiles, db.bodyMetrics, db.meals, db.mealItems, db.foodOverrides, db.settings],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.bodyMetrics.clear(),
        db.meals.clear(),
        db.mealItems.clear(),
        db.foodOverrides.clear(),
        db.settings.clear()
      ]);
      if (payload.profiles.length) await db.profiles.bulkAdd(payload.profiles as never[]);
      if (payload.bodyMetrics.length) await db.bodyMetrics.bulkAdd(payload.bodyMetrics as never[]);
      if (payload.meals.length) await db.meals.bulkAdd(payload.meals as never[]);
      if (payload.mealItems.length) await db.mealItems.bulkAdd(payload.mealItems as never[]);
      if (payload.foodOverrides.length) await db.foodOverrides.bulkAdd(payload.foodOverrides as never[]);
      if (payload.settings.length) await db.settings.bulkAdd(payload.settings as never[]);
    }
  );
}
