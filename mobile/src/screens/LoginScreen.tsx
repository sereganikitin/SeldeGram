import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const submit = async () => {
    setLoading(true);
    try {
      const payload: { email: string; password: string; totpCode?: string } = { email, password };
      if (needs2fa && totpCode) payload.totpCode = totpCode;
      const { data } = await api.post('/auth/login', payload);
      if (data.requires2fa) {
        setNeeds2fa(true);
        return;
      }
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
      {needs2fa && (
        <Input
          label="Код из приложения-аутентификатора"
          value={totpCode}
          onChangeText={(v) => setTotpCode(v.replace(/\s+/g, ''))}
          keyboardType="number-pad"
          maxLength={8}
        />
      )}
      <Button title={needs2fa ? 'Подтвердить' : 'Войти'} onPress={submit} loading={loading} />
      {!needs2fa && (
        <Text style={styles.link} onPress={() => navigation.navigate('ForgotPassword')}>
          Забыли пароль?
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff5f9' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  link: { marginTop: 16, color: '#e84e76', fontWeight: '600', textAlign: 'center' },
});
