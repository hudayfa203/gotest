import { useColorScheme } from 'react-native';
import { color, type ColorSchemeName, type Palette } from '../theme';
import { useSettings } from './settings';

export interface Theme {
  scheme: ColorSchemeName;
  isDark: boolean;
  c: Palette;
}

/** Active colour scheme: the in-app Appearance setting (System / Light / Dark) over the OS setting. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const appearance = useSettings((s) => s.appearance);
  const scheme: ColorSchemeName = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  return { scheme, isDark: scheme === 'dark', c: color[scheme] };
}
