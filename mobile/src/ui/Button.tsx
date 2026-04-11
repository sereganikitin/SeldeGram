import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled }: Props) {
  const isSecondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.primary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? '#ff7a99' : '#fff'} />
      ) : (
        <Text style={[styles.text, isSecondary ? styles.textSecondary : styles.textPrimary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#ff7a99' },
  secondary: { backgroundColor: '#ffe8f0', borderWidth: 1, borderColor: '#ff7a99' },
  text: { fontSize: 16, fontWeight: '600' },
  textPrimary: { color: '#fff' },
  textSecondary: { color: '#e84e76' },
});
