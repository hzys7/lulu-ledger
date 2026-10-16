// useThemeColors: convenience hook that pairs a theme-aware color palette
// with the current settings. Pulling settings from the dedicated
// SettingsContext means components that only need theme colors do NOT
// re-render on transaction / account / budget changes.
import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { getThemeColors, neuStyles } from '../theme';

export function useThemeColors() {
  const { settings } = useSettings();
  return getThemeColors(settings.theme);
}

// useNeu: 新拟物样式助手（凸起 / 凹陷 / 平面），随主题切换自动更新
export function useNeu() {
  const tc = useThemeColors();
  return useMemo(() => neuStyles(tc), [tc]);
}
