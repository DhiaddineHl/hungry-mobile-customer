import Svg, { Circle, Rect } from 'react-native-svg';

const RED = '#E70013';

interface TunisiaFlagProps {
  width?: number;
  height?: number;
}

/**
 * Tunisian flag drawn inline (red field, white disc, red crescent) so the
 * country pill has no network dependency at this size.
 */
export function TunisiaFlag({ width = 24, height = 16 }: TunisiaFlagProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 16">
      <Rect width={24} height={16} rx={2} fill={RED} />
      <Circle cx={12} cy={8} r={5} fill="#FFFFFF" />
      <Circle cx={12.6} cy={8} r={3.6} fill={RED} />
      <Circle cx={14} cy={8} r={2.9} fill="#FFFFFF" />
    </Svg>
  );
}
