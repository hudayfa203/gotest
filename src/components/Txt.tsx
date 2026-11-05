import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../state/theme';
import { fonts } from '../theme';

export type TxtVariant =
  | 'display' // Montserrat 900 — lead headlines
  | 'headline' // Montserrat 800 — article/card headlines
  | 'title' // Montserrat 700 — section titles, screen titles
  | 'kicker' // Inter 600 — category names, small labels (sentence case, as on goworld.news)
  | 'ui' // Inter 500 — interface text
  | 'uiStrong' // Inter 600
  | 'uiBold' // Inter 700
  | 'body' // Inter 400
  | 'serif' // Source Serif 4 400 — reading text
  | 'serifItalic'
  | 'serifStrong'; // Source Serif 4 600

const FAMILY: Record<TxtVariant, string> = {
  display: fonts.display900,
  headline: fonts.display800,
  title: fonts.display700,
  kicker: fonts.ui600,
  ui: fonts.ui500,
  uiStrong: fonts.ui600,
  uiBold: fonts.ui700,
  body: fonts.ui400,
  serif: fonts.serif400,
  serifItalic: fonts.serif400Italic,
  serifStrong: fonts.serif600,
};

const DEFAULT_SIZE: Record<TxtVariant, number> = {
  display: 28, headline: 18, title: 18, kicker: 11, ui: 14, uiStrong: 14, uiBold: 14, body: 15, serif: 17, serifItalic: 17, serifStrong: 17,
};

const LINE: Partial<Record<TxtVariant, number>> = { display: 1.14, headline: 1.2, title: 1.25, kicker: 1.2, serif: 1.6, serifItalic: 1.6, serifStrong: 1.5 };

export interface TxtProps extends TextProps {
  variant?: TxtVariant;
  size?: number;
  color?: string;
  muted?: boolean;
  align?: TextStyle['textAlign'];
  lineHeight?: number;
  uppercase?: boolean;
}

/** Brand text: one family per weight (Android ignores fontWeight with custom fonts). Dynamic Type stays on. */
export function Txt({ variant = 'body', size, color, muted, align, lineHeight, uppercase, style, maxFontSizeMultiplier, ...rest }: TxtProps) {
  const { c } = useTheme();
  const fs = size ?? DEFAULT_SIZE[variant];
  const lh = lineHeight ?? Math.round(fs * (LINE[variant] ?? 1.4));
  const isHeading = variant === 'display' || variant === 'headline' || variant === 'title';
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (variant === 'kicker' ? 1.4 : isHeading ? 1.6 : 2)}
      style={[
        {
          fontFamily: FAMILY[variant],
          fontSize: fs,
          lineHeight: lh,
          color: color ?? (muted ? c.textMuted : isHeading ? c.heading : c.text),
          textAlign: align,
          letterSpacing: variant === 'kicker' ? 0.1 : isHeading ? -0.2 : 0,
          textTransform: uppercase ? 'uppercase' : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}
