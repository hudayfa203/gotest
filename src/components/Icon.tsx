import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

/** Line icons drawn with react-native-svg (24×24 grid, 2px strokes) — no icon-font download needed. */
export type IconName =
  | 'home' | 'latest' | 'explore' | 'video' | 'saved' | 'saved-filled' | 'share' | 'text-size' | 'browser'
  | 'back' | 'chevron-right' | 'close' | 'settings' | 'play' | 'pause' | 'headphones' | 'refresh' | 'offline'
  | 'check' | 'trash' | 'mail' | 'bell' | 'search' | 'user' | 'info' | 'alert' | 'arrow-up' | 'sliders' | 'clock' | 'external'
  | 'pin' | 'archive' | 'pencil' | 'broadcast';

export function Icon({ name, size = 24, color = '#000', strokeWidth = 2, filled = false }: { name: IconName; size?: number; color?: string; strokeWidth?: number; filled?: boolean }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const f = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {(() => {
        switch (name) {
          case 'home':
            return (
              <>
                <Path {...p} fill={f} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
              </>
            );
          case 'latest':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} fill={filled ? color : 'none'} />
                <Polyline {...p} stroke={filled ? '#fff' : color} points="12 7 12 12 15.5 14" />
              </>
            );
          case 'clock':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} />
                <Polyline {...p} points="12 7 12 12 15.5 14" />
              </>
            );
          case 'explore':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} />
                <Path {...p} fill={f} d="m15.5 8.5-2 5-5 2 2-5z" />
              </>
            );
          case 'search':
            return (
              <>
                <Circle {...p} cx={11} cy={11} r={7} />
                <Line {...p} x1={16.5} y1={16.5} x2={21} y2={21} />
              </>
            );
          case 'video':
            return (
              <>
                <Rect {...p} x={2.5} y={5} width={19} height={14} rx={3} fill={f} />
                <Path {...p} stroke={filled ? '#fff' : color} fill={filled ? '#fff' : 'none'} d="m10 9 5 3-5 3z" />
              </>
            );
          case 'saved':
          case 'saved-filled':
            return <Path {...p} fill={name === 'saved-filled' || filled ? color : 'none'} d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />;
          case 'share':
            return (
              <>
                <Path {...p} d="M12 3v12" />
                <Polyline {...p} points="7.5 7.5 12 3 16.5 7.5" />
                <Path {...p} d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </>
            );
          case 'text-size':
            return (
              <>
                <Path {...p} d="M3 19 8 6l5 13M4.8 14.5h6.4" />
                <Path {...p} d="m14 19 3.5-8.5L21 19m-5.8-3h4.6" />
              </>
            );
          case 'browser':
          case 'external':
            return (
              <>
                <Path {...p} d="M14 4h6v6" />
                <Line {...p} x1={20} y1={4} x2={11} y2={13} />
                <Path {...p} d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </>
            );
          case 'back':
            return <Polyline {...p} points="15 4 7 12 15 20" />;
          case 'chevron-right':
            return <Polyline {...p} points="9 5 16 12 9 19" />;
          case 'close':
            return (
              <>
                <Line {...p} x1={6} y1={6} x2={18} y2={18} />
                <Line {...p} x1={18} y1={6} x2={6} y2={18} />
              </>
            );
          case 'settings':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={3} />
                <Path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </>
            );
          case 'play':
            return <Path fill={color} stroke={color} strokeWidth={1.5} strokeLinejoin="round" d="M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5z" />;
          case 'pause':
            return (
              <>
                <Rect x={6} y={4.5} width={4} height={15} rx={1} fill={color} />
                <Rect x={14} y={4.5} width={4} height={15} rx={1} fill={color} />
              </>
            );
          case 'headphones':
            return (
              <>
                <Path {...p} d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <Path {...p} fill={f} d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </>
            );
          case 'refresh':
            return (
              <>
                <Polyline {...p} points="20 4 20 10 14 10" />
                <Path {...p} d="M19.5 14.5A8 8 0 1 1 18 7.2L20 10" />
              </>
            );
          case 'offline':
            return (
              <>
                <Line {...p} x1={2} y1={2} x2={22} y2={22} />
                <Path {...p} d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5" />
                <Circle cx={12} cy={20} r={1} fill={color} />
              </>
            );
          case 'check':
            return <Polyline {...p} points="4 12.5 9.5 18 20 6" />;
          case 'trash':
            return (
              <>
                <Polyline {...p} points="3 6 21 6" />
                <Path {...p} d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </>
            );
          case 'mail':
            return (
              <>
                <Rect {...p} x={3} y={5} width={18} height={14} rx={2} />
                <Polyline {...p} points="3.5 6 12 13 20.5 6" />
              </>
            );
          case 'bell':
            return (
              <>
                <Path {...p} fill={f} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <Path {...p} d="M13.7 21a2 2 0 0 1-3.4 0" />
              </>
            );
          case 'user':
            return (
              <>
                <Circle {...p} cx={12} cy={8} r={4} />
                <Path {...p} d="M4 21a8 8 0 0 1 16 0" />
              </>
            );
          case 'info':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} />
                <Line {...p} x1={12} y1={11} x2={12} y2={16.5} />
                <Circle cx={12} cy={7.6} r={1.1} fill={color} />
              </>
            );
          case 'alert':
            return (
              <>
                <Path {...p} d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <Line {...p} x1={12} y1={9} x2={12} y2={13} />
                <Circle cx={12} cy={17} r={1.1} fill={color} />
              </>
            );
          case 'arrow-up':
            return (
              <>
                <Line {...p} x1={12} y1={19} x2={12} y2={5} />
                <Polyline {...p} points="5 12 12 5 19 12" />
              </>
            );
          case 'pin':
            return (
              <>
                <Path {...p} fill={f} d="M9 3h6l-1 6 4 4H6l4-4z" />
                <Line {...p} x1={12} y1={13} x2={12} y2={21} />
              </>
            );
          case 'archive':
            return (
              <>
                <Rect {...p} x={3} y={4} width={18} height={5} rx={1} />
                <Path {...p} d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
                <Line {...p} x1={10} y1={13} x2={14} y2={13} />
              </>
            );
          case 'pencil':
            return (
              <>
                <Path {...p} d="M15.5 4.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
              </>
            );
          case 'broadcast':
            return (
              <>
                <Circle cx={12} cy={12} r={2.2} fill={color} />
                <Path {...p} d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
                <Path {...p} d="M5.3 18.7a9.5 9.5 0 0 1 0-13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
              </>
            );
          case 'sliders':
            return (
              <>
                <Line {...p} x1={4} y1={7} x2={20} y2={7} />
                <Line {...p} x1={4} y1={17} x2={20} y2={17} />
                <Circle {...p} cx={9} cy={7} r={2.4} fill="#0000" />
                <Circle {...p} cx={15} cy={17} r={2.4} fill="#0000" />
              </>
            );
        }
      })()}
    </Svg>
  );
}
