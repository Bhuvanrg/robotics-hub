import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserPreferences {
  location?: string; // City, State
  bio?: string;
  interests: string[]; // tags / topics
  team?: string;
  displayNameOverride?: string; // allow user to override auth display name
  // Account & privacy flags
  showInTeamFinder: boolean; // whether user is discoverable in Team Finder
  publicProfile: boolean; // whether profile is publicly visible (future use)
  emailNotifications: boolean; // whether to receive email notifications (placeholder)
  emailFrequency: 'daily' | 'weekly' | 'off'; // digest cadence
}

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (delta: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPrefs: UserPreferences = {
  interests: [],
  showInTeamFinder: true,
  publicProfile: true,
  emailNotifications: true,
  emailFrequency: 'weekly',
};

const Ctx = createContext<UserPreferencesContextValue | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const raw = localStorage.getItem('rh:user:prefs');
      if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
    } catch {
      // ignore parse/storage errors
    }
    return defaultPrefs;
  });

  useEffect(() => {
    try {
      localStorage.setItem('rh:user:prefs', JSON.stringify(preferences));
    } catch {
      // ignore write errors
    }
  }, [preferences]);

  const updatePreferences = (delta: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...delta }));
  };

  const resetPreferences = () => setPreferences(defaultPrefs);

  return (
    <Ctx.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUserPreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  return ctx;
}
