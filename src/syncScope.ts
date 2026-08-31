export type SyncScope = "SYNCED_BUSINESS_DATA" | "KEY_SCOPED";
export type SettingScope = "SYNCED_BUSINESS_DATA" | "LOCAL_ONLY" | "TRANSIENT";

export const TABLE_SYNC_SCOPE = {
  profiles: "SYNCED_BUSINESS_DATA",
  bodyMetrics: "SYNCED_BUSINESS_DATA",
  meals: "SYNCED_BUSINESS_DATA",
  mealItems: "SYNCED_BUSINESS_DATA",
  foodOverrides: "SYNCED_BUSINESS_DATA",
  settings: "KEY_SCOPED"
} as const satisfies Record<string, SyncScope>;

export function settingSyncScope(key: string): SettingScope {
  if (key === "restoreRollback") return "TRANSIENT";
  if (key.startsWith("sync:")) return "LOCAL_ONLY";
  return "SYNCED_BUSINESS_DATA";
}

export function isSyncedSettingKey(key: string): boolean {
  return settingSyncScope(key) === "SYNCED_BUSINESS_DATA";
}
