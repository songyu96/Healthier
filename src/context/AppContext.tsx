import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { UserProfile } from "../domain";
import { db } from "../db";

interface AppContextValue {
  profile?: UserProfile;
  saveProfile: (profile: UserProfile) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const profile = useLiveQuery(() => db.profiles.get("default"), []);
  const value = useMemo<AppContextValue>(() => ({
    profile,
    saveProfile: async (nextProfile) => {
      await db.profiles.put(nextProfile);
    }
  }), [profile]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp必须在AppProvider中使用。 ");
  return context;
}

