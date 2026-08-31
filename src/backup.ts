import { z } from "zod";
import { db, materializeMissingNutritionSnapshots } from "./db";
import { mergeFoodRegistry } from "./domain/nutrition/foodRegistry";
import { backupPayloadSchema, type BackupPayload } from "./backupSchemas";
import { isSyncedSettingKey, settingSyncScope } from "./syncScope";
export type { BackupPayload } from "./backupSchemas";

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const envelopeFields = {
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
};
const envelopeV1Schema = z.object({
  format: z.literal("HD-BACKUP-1"),
  appSchemaVersion: z.literal(1),
  ...envelopeFields
}).strict();
const envelopeV2Schema = z.object({
  format: z.literal("HD-BACKUP-2"),
  appSchemaVersion: z.literal(2),
  ...envelopeFields
}).strict();
const envelopeSchema = z.discriminatedUnion("format", [envelopeV1Schema, envelopeV2Schema]);

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
  return db.transaction(
    "r",
    [db.profiles, db.bodyMetrics, db.meals, db.mealItems, db.foodOverrides, db.settings],
    async () => backupPayloadSchema.parse({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      profiles: await db.profiles.toArray(),
      bodyMetrics: await db.bodyMetrics.toArray(),
      meals: await db.meals.toArray(),
      mealItems: await db.mealItems.toArray(),
      foodOverrides: await db.foodOverrides.toArray(),
      settings: (await db.settings.toArray()).filter((setting) => isSyncedSettingKey(setting.key))
    })
  );
}

export async function encryptBackupPayload(payload: BackupPayload, password: string): Promise<string> {
  const validated = backupPayloadSchema.parse(payload);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(validated))
  );

  return JSON.stringify({
    format: "HD-BACKUP-2",
    appSchemaVersion: 2,
    createdAt: validated.exportedAt,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
    cipher: { name: "AES-GCM", length: 256 },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  });
}

export async function exportEncryptedBackup(password: string): Promise<string> {
  return encryptBackupPayload(await readBackupPayload(), password);
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
    return backupPayloadSchema.parse(JSON.parse(decoder.decode(plaintext)));
  } catch {
    throw new Error("密码错误或备份文件已经损坏。");
  }
}

export async function restoreBackup(payload: BackupPayload, rollbackPassword: string): Promise<void> {
  const validated = backupPayloadSchema.parse(payload);
  const rollback = await exportEncryptedBackup(rollbackPassword);
  const restoredFoods = mergeFoodRegistry(validated.foodOverrides);
  const restoredMeals = materializeMissingNutritionSnapshots(
    validated.meals,
    validated.mealItems,
    restoredFoods
  );
  const restoredSettings = validated.settings.filter((setting) => isSyncedSettingKey(setting.key));

  await db.transaction(
    "rw",
    [db.profiles, db.bodyMetrics, db.meals, db.mealItems, db.foodOverrides, db.settings],
    async () => {
      const localOnlySettings = (await db.settings.toArray()).filter(
        (setting) => settingSyncScope(setting.key) === "LOCAL_ONLY"
      );

      await Promise.all([
        db.profiles.clear(),
        db.bodyMetrics.clear(),
        db.meals.clear(),
        db.mealItems.clear(),
        db.foodOverrides.clear(),
        db.settings.clear()
      ]);
      if (validated.profiles.length) await db.profiles.bulkAdd(validated.profiles);
      if (validated.bodyMetrics.length) await db.bodyMetrics.bulkAdd(validated.bodyMetrics);
      if (restoredMeals.length) await db.meals.bulkAdd(restoredMeals);
      if (validated.mealItems.length) await db.mealItems.bulkAdd(validated.mealItems);
      if (validated.foodOverrides.length) await db.foodOverrides.bulkAdd(validated.foodOverrides);
      if (restoredSettings.length) await db.settings.bulkAdd(restoredSettings);
      if (localOnlySettings.length) await db.settings.bulkAdd(localOnlySettings);
      await db.settings.put({ key: "restoreRollback", value: rollback });
    }
  );
}
