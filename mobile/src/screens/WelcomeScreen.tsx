import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Button } from '../ui/Button';
import { CrabLogo } from '../ui/CrabLogo';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <CrabLogo size={120} />
      <Text style={[styles.title, { color: colors.text }]}>CraboGram</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Самый нежный мессенджер 🦀</Text>
      <View style={styles.buttons}>
        <Button title="Войти" onPress={() => navigation.navigate('Login')} />
        <Button title="Создать аккаунт" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 40, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 48 },
  buttons: { width: '100%', gap: 12 },
});
