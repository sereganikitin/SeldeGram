import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { avatarColor, initials } from '../helpers';
import { getMediaUrl } from '../media';

interface Props {
  id: string;
  name: string;
  avatarKey?: string | null;
  size?: number;
}

export function Avatar({ id, name, avatarKey, size = 44 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarKey) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getMediaUrl(avatarKey).then((u) => !cancelled && setUrl(u)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [avatarKey]);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#0001' }}
      />
    );
  }

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
