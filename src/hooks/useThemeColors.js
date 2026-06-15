// useThemeColors: convenience hook that pairs a theme-aware color palette
// with the current settings. Pulling settings from the dedicated
// SettingsContext means components that only need theme colors do NOT
// re-render on transaction / account / budget changes.
import { useSettings } from '../context/SettingsContext';
import { getThemeColors } from '../theme';

export function useThemeColors() {
  const { settings } = useSettings();
  return getThemeColors(settings.theme);
}
