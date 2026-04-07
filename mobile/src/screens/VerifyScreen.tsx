import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Verify'>;

export function VerifyScreen({ route }: Props) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify', { email, code });
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
      <Text style={styles.title}>Подтверждение</Text>
      <Text style={styles.hint}>Мы отправили 6-значный код на {email}</Text>
      <Input label="Код из письма" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <Button title="Подтвердить" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 14, color: '#666', marginBottom: 24 },
});
