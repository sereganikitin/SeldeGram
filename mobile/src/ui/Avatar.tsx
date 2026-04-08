import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColor, initials } from '../helpers';

interface Props {
  id: string;
  name: string;
  size?: number;
}

export function Avatar({ id, name, size = 44 }: Props) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id) },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
