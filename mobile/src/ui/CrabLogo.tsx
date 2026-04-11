import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
  Circle,
  Line,
  Path,
} from 'react-native-svg';

export function CrabLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Defs>
        <LinearGradient id="crab-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ff9bb5" />
          <Stop offset="100%" stopColor="#e84e76" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="11" cy="34" rx="7" ry="5" fill="url(#crab-grad)" />
      <Ellipse cx="53" cy="34" rx="7" ry="5" fill="url(#crab-grad)" />
      <Ellipse cx="32" cy="36" rx="20" ry="14" fill="url(#crab-grad)" />
      <Circle cx="24" cy="28" r="4" fill="#fff" />
      <Circle cx="40" cy="28" r="4" fill="#fff" />
      <Circle cx="24" cy="28" r="2" fill="#3d1a28" />
      <Circle cx="40" cy="28" r="2" fill="#3d1a28" />
      <Line x1="15" y1="44" x2="10" y2="52" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <Line x1="22" y1="48" x2="20" y2="56" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <Line x1="42" y1="48" x2="44" y2="56" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <Line x1="49" y1="44" x2="54" y2="52" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 38 Q32 41 36 38" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
