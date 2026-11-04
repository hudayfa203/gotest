/**
 * Brand + semantic design tokens.
 * MIRRORS packages/design-tokens/src/index.ts (approved palette, contrast-tested pairs). Keep in sync.
 * Rule: never put white text on Sky (#2EA3F2).
 */

export const brand = {
  navy: '#0B2A5E',
  red: '#E1141E',
  white: '#FFFFFF',
  deepNavy: '#061A40',
  royal: '#1A4FB0',
  sky: '#2EA3F2',
} as const;

export const color = {
  light: {
    bg: '#FFFFFF', surface: '#F4F6FA', surfaceRaised: '#FFFFFF', border: '#DCE2EC',
    text: '#0E1A2E', textMuted: '#4A5871', heading: brand.navy, link: brand.royal,
    brand: brand.navy, onBrand: '#FFFFFF', accent: brand.red, onAccent: '#FFFFFF',
    breaking: '#C8101A', onBreaking: '#FFFFFF', live: '#C8101A', developing: '#B4540A', exclusive: brand.navy,
    focus: brand.royal, success: '#0F7A3B', warning: '#8A5A00', danger: '#B3121B',
  },
  dark: {
    bg: '#071224', surface: '#0C1B33', surfaceRaised: '#122544', border: '#22385E',
    text: '#E8EEF8', textMuted: '#A9B6CC', heading: '#FFFFFF', link: '#8CC8FF',
    brand: '#FFFFFF', onBrand: brand.deepNavy, accent: brand.red, onAccent: '#FFFFFF',
    breaking: '#E1141E', onBreaking: '#FFFFFF', live: '#FF5A5F', developing: '#F0A04B', exclusive: '#8CC8FF',
    focus: brand.sky, success: '#4ACB7D', warning: '#F2C14E', danger: '#FF6B6B',
  },
} as const;

export type ColorSchemeName = keyof typeof color;
export type Palette = { [K in keyof (typeof color)['light']]: string };

/** Font families as registered with expo-font (one family per weight so Android renders correctly). */
export const fonts = {
  display500: 'Montserrat-500',
  display600: 'Montserrat-600',
  display700: 'Montserrat-700',
  display800: 'Montserrat-800',
  display900: 'Montserrat-900',
  display800Italic: 'Montserrat-800-Italic',
  display900Italic: 'Montserrat-900-Italic',
  ui400: 'Inter-400',
  ui500: 'Inter-500',
  ui600: 'Inter-600',
  ui700: 'Inter-700',
  serif400: 'SourceSerif4-400',
  serif400Italic: 'SourceSerif4-400-Italic',
  serif600: 'SourceSerif4-600',
  serif700: 'SourceSerif4-700',
} as const;

export const fontFiles = {
  [fonts.display500]: require('../assets/fonts/montserrat-500-normal.ttf'),
  [fonts.display600]: require('../assets/fonts/montserrat-600-normal.ttf'),
  [fonts.display700]: require('../assets/fonts/montserrat-700-normal.ttf'),
  [fonts.display800]: require('../assets/fonts/montserrat-800-normal.ttf'),
  [fonts.display900]: require('../assets/fonts/montserrat-900-normal.ttf'),
  [fonts.display800Italic]: require('../assets/fonts/montserrat-800-italic.ttf'),
  [fonts.display900Italic]: require('../assets/fonts/montserrat-900-italic.ttf'),
  [fonts.ui400]: require('../assets/fonts/inter-400-normal.ttf'),
  [fonts.ui500]: require('../assets/fonts/inter-500-normal.ttf'),
  [fonts.ui600]: require('../assets/fonts/inter-600-normal.ttf'),
  [fonts.ui700]: require('../assets/fonts/inter-700-normal.ttf'),
  [fonts.serif400]: require('../assets/fonts/source-serif-4-400-normal.ttf'),
  [fonts.serif400Italic]: require('../assets/fonts/source-serif-4-400-italic.ttf'),
  [fonts.serif600]: require('../assets/fonts/source-serif-4-600-normal.ttf'),
  [fonts.serif700]: require('../assets/fonts/source-serif-4-700-normal.ttf'),
} as const;

/** Type scale (pt). Apps use bodyApp 17 and scale with OS Dynamic Type + the in-app text size. */
export const fontSize = {
  label: 12, caption: 13, small: 14, body: 18, bodyApp: 17, lead: 20,
  h4: 20, h3: 24, h2: 30, h1: 40, display: 52,
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 } as const;
export const radius = { none: 0, sm: 4, md: 8, lg: 12, xl: 18, pill: 999 } as const;
/** Comfortable reading measure for article text on tablets. */
export const articleMeasure = 680;
/** Minimum touch target (Apple HIG 44pt / Material 48dp). */
export const hitTarget = 44;

/** In-app text-size steps for article reading (A− / A+). */
export const textScaleSteps = [0.85, 1, 1.15, 1.3, 1.5] as const;
