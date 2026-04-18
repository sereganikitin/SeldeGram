import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

type Variant = 'filled' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  icon: LucideIcon;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const sizeMap: Record<Size, { box: number; icon: number }> = {
  sm: { box: 32, icon: 16 },
  md: { box: 40, icon: 20 },
  lg: { box: 48, icon: 22 },
};

function variantColors(variant: Variant): { bg: string; fg: string } {
  switch (variant) {
    case 'filled':
      return { bg: '#ff7a99', fg: '#fff' };
    case 'ghost':
      return { bg: '#ffe8f0', fg: '#e84e76' };
    case 'danger':
      return { bg: '#ef4444', fg: '#fff' };
    case 'success':
      return { bg: '#22c55e', fg: '#fff' };
  }
}

export function IconButton({
  icon: Icon,
  onPress,
  variant = 'filled',
  size = 'md',
  disabled,
  style,
  accessibilityLabel,
}: Props) {
  const { box, icon } = sizeMap[size];
  const { bg, fg } = variantColors(variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box, backgroundColor: bg },
        (pressed || disabled) && { opacity: 0.6 },
        style,
      ]}
    >
      <Icon size={icon} color={fg} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
