import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 10 },
  text: {
    backgroundColor: '#0001',
    color: '#555',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
