// SettingsContext: theme, currency, autoCheckUpdate, etc.
// Kept independent so that components consuming only settings (Button, PieRing,
// TransactionItem, etc.) do NOT re-render when transactions / accounts change.
import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import * as storage from '../utils/storage';
import { DEFAULT_SETTINGS } from './sanitizers';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [loaded, setLoaded] = useState(false);

  const initFromStorage = useCallback(async () => {
    const stored = await storage.getSettings();
    setSettings({ ...DEFAULT_SETTINGS, ...(stored || {}) });
    setLoaded(true);
  }, []);

  const updateAppSettings = useCallback(async (updates) => {
    const next = await storage.updateSettings(updates);
    setSettings({ ...DEFAULT_SETTINGS, ...(next || {}) });
    return next;
  }, []);

  const value = useMemo(() => ({
    settings,
    loaded,
    updateAppSettings,
    initFromStorage,
  }), [settings, loaded, updateAppSettings, initFromStorage]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
