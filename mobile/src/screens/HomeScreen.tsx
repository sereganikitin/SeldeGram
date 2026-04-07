import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { useAuth } from '../store/auth';

export function HomeScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Привет, {user?.displayName}!</Text>
      <Text style={styles.line}>id: {user?.id}</Text>
      <Text style={styles.line}>email: {user?.email}</Text>
      <Text style={styles.line}>username: @{user?.username}</Text>
      <Text style={styles.line}>verified: {user?.isVerified ? '✓' : '✗'}</Text>
      <View style={{ height: 32 }} />
      <Button title="Выйти" variant="secondary" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24 },
  line: { fontSize: 14, color: '#444', marginBottom: 6 },
});
