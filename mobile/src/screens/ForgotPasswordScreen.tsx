import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const requestCode = async () => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert(
        'Код отправлен',
        'Если такой email зарегистрирован, мы отправили на него 6-значный код. Проверьте почту.',
      );
      setStep('reset');
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? 'Ошибка';
      Alert.alert('Не получилось', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', { email, code, newPassword });
      await setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? 'Ошибка';
      Alert.alert('Не получилось', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'request') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Восстановление пароля</Text>
        <Text style={styles.hint}>
          Укажите email вашего аккаунта — мы пришлём 6-значный код для сброса пароля.
        </Text>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button title="Отправить код" onPress={requestCode} loading={loading} />
        <Text style={styles.link} onPress={() => navigation.goBack()}>
          Вернуться ко входу
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Новый пароль</Text>
      <Text style={styles.hint}>Введите код из письма и новый пароль.</Text>
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Код из письма" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <Input label="Новый пароль (от 8 символов)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <Button title="Сменить пароль" onPress={resetPassword} loading={loading} />
      <Text style={styles.link} onPress={() => setStep('request')}>
        Отправить код ещё раз
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff5f9' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 14, color: '#8c6471', marginBottom: 24 },
  link: { marginTop: 16, color: '#e84e76', fontWeight: '600', textAlign: 'center' },
});
