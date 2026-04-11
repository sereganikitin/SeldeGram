import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? 'Ошибка';
      Alert.alert('Не получилось', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход</Text>
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Input label="Пароль" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Войти" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff5f9' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
});
