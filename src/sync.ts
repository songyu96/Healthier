import { z } from "zod";
import {
  decryptBackup,
  encryptBackupPayload,
  readBackupPayload,
  type BackupPayload
} from "./backup";
import { getSetting, setSetting } from "./db";
import { isSyncedSettingKey } from "./syncScope";

export const SYNC_STATE_KEY = "sync:file-state";
export const SYNC_FORMAT = "HD-SYNC-1";
export const SYNC_FORMAT_VERSION = 1;

const syncPackageSchema = z.object({
  format: z.literal(SYNC_FORMAT),
  syncFormatVersion: z.number().int().positive(),
  versionId: z.string().uuid(),
  parentVersionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  payloadSchemaVersion: z.number().int().positive(),
  encryptedBackup: z.string().min(1)
}).strict();

const localSyncStateSchema = z.object({
  deviceId: z.string().uuid(),
  baselineVersionId: z.string().uuid().optional(),
  baselineBusinessDataHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  lastSyncedAt: z.string().datetime().optional()
}).strict();

export type SyncPackage = z.infer<typeof syncPackageSchema>;
export type LocalSyncState = z.infer<typeof localSyncStateSchema>;
export type SyncImportStatus = "FIRST_IMPORT" | "REMOTE_UPDATE" | "SAME_VERSION" | "CONFLICT";

export interface CreatedSyncPackage {
  text: string;
  package: SyncPackage;
  payload: BackupPayload;
  businessDataHash: string;
}

export interface InspectedSyncPackage {
  package: SyncPackage;
  payload: BackupPayload;
  businessDataHash: string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

function sortByKey<T>(values: T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right)));
}

export function canonicalBusinessData(payload: BackupPayload): string {
  return JSON.stringify(stableValue({
    profiles: sortByKey(payload.profiles, (item) => item.id),
    bodyMetrics: sortByKey(payload.bodyMetrics, (item) => item.id),
    meals: sortByKey(payload.meals, (item) => item.id),
    mealItems: sortByKey(payload.mealItems, (item) => item.id),
    foodOverrides: sortByKey(payload.foodOverrides, (item) => item.id),
    settings: sortByKey(
      payload.settings.filter((setting) => isSyncedSettingKey(setting.key)),
      (setting) => setting.key
    )
  }));
}

export async function calculateBusinessDataHash(payload: BackupPayload): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalBusinessData(payload));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getLocalSyncState(): Promise<LocalSyncState> {
  const stored = localSyncStateSchema.safeParse(
    await getSetting<unknown>(SYNC_STATE_KEY, undefined)
  );
  if (stored.success) return stored.data;
  const state: LocalSyncState = { deviceId: crypto.randomUUID() };
  await setSetting(SYNC_STATE_KEY, state);
  return state;
}

export async function acceptSyncBaseline(
  syncPackage: SyncPackage,
  businessDataHash: string
): Promise<LocalSyncState> {
  const current = await getLocalSyncState();
  const next: LocalSyncState = {
    ...current,
    baselineVersionId: syncPackage.versionId,
    baselineBusinessDataHash: businessDataHash,
    lastSyncedAt: new Date().toISOString()
  };
  await setSetting(SYNC_STATE_KEY, next);
  return next;
}

export async function createSyncPackage(password: string): Promise<CreatedSyncPackage> {
  const [payload, state] = await Promise.all([readBackupPayload(), getLocalSyncState()]);
  const businessDataHash = await calculateBusinessDataHash(payload);
  const encryptedBackup = await encryptBackupPayload(payload, password);
  const syncPackage: SyncPackage = {
    format: SYNC_FORMAT,
    syncFormatVersion: SYNC_FORMAT_VERSION,
    versionId: crypto.randomUUID(),
    parentVersionId: state.baselineVersionId ?? null,
    createdAt: new Date().toISOString(),
    payloadSchemaVersion: payload.schemaVersion,
    encryptedBackup
  };
  return {
    text: JSON.stringify(syncPackage),
    package: syncPackage,
    payload,
    businessDataHash
  };
}

export function parseSyncPackage(text: string): SyncPackage {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("同步包不是有效JSON。");
  }
  const parsed = syncPackageSchema.parse(raw);
  if (parsed.syncFormatVersion !== SYNC_FORMAT_VERSION) {
    throw new Error(`暂不支持同步包版本 ${parsed.syncFormatVersion}。`);
  }
  return parsed;
}

export async function inspectSyncPackage(
  text: string,
  password: string
): Promise<InspectedSyncPackage> {
  const syncPackage = parseSyncPackage(text);
  const payload = await decryptBackup(syncPackage.encryptedBackup, password);
  if (payload.schemaVersion !== syncPackage.payloadSchemaVersion) {
    throw new Error("同步包外层版本与加密数据不一致。");
  }
  return {
    package: syncPackage,
    payload,
    businessDataHash: await calculateBusinessDataHash(payload)
  };
}

export function classifySyncImport(
  state: LocalSyncState,
  currentBusinessDataHash: string,
  incoming: SyncPackage
): SyncImportStatus {
  if (!state.baselineVersionId || !state.baselineBusinessDataHash) return "FIRST_IMPORT";
  const localChanged = currentBusinessDataHash !== state.baselineBusinessDataHash;
  if (incoming.versionId === state.baselineVersionId) {
    return localChanged ? "CONFLICT" : "SAME_VERSION";
  }
  const followsBaseline = incoming.parentVersionId === state.baselineVersionId;
  return !localChanged && followsBaseline ? "REMOTE_UPDATE" : "CONFLICT";
}
