import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneAuth'>;
type Step = 'phone' | 'code' | 'register';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return digits ? `+${digits}` : '';
}

export function PhoneAuthScreen({ navigation }: Props) {
  const setTokens = useAuth((s) => s.setTokens);
  const fetchMe = useAuth((s) => s.fetchMe);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const showError = (e: any) => {
    const msg = e.response?.data?.message ?? e.message ?? 'Ошибка';
    Alert.alert('Не получилось', Array.isArray(msg) ? msg.join('\n') : String(msg));
  };

  const requestCode = async () => {
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
        throw new Error('Введите номер в формате +7XXXXXXXXXX');
      }
      const { data } = await api.post<{
        ok: boolean;
        needsRegistration: boolean;
        resendAfterSec: number;
      }>('/auth/phone/request-code', { phone: normalized });
      setPhone(normalized);
      setNeedsRegistration(data.needsRegistration);
      setResendIn(data.resendAfterSec);
      setStep('code');
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (needsRegistration && step !== 'register') {
      setStep('register');
      return;
    }
    setLoading(true);
    try {
      const payload: any = { phone, code };
      if (needsRegistration) {
        payload.username = username;
        payload.displayName = displayName;
      }
      const { data } = await api.post('/auth/phone/verify', payload);
      await setTokens(data.accessToken, data.refreshToken);
      await fetchMe();
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CraboGram</Text>

      {step === 'phone' && (
        <>
          <Text style={styles.hint}>Введи номер телефона — пришлём код для входа.</Text>
          <Input
            label="Номер"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+7 999 123 45 67"
          />
          <Button title="Прислать код" onPress={requestCode} loading={loading} />
        </>
      )}

      {step === 'code' && (
        <>
          <Text style={styles.hint}>
            Код отправлен на {phone}.{' '}
            <Text style={styles.linkInline} onPress={() => setStep('phone')}>
              изменить
            </Text>
          </Text>
          <Input
            label="Код"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
          />
          <Button
            title={needsRegistration ? 'Дальше' : 'Войти'}
            onPress={verify}
            loading={loading}
            disabled={code.length !== 6}
          />
          <Pressable onPress={requestCode} disabled={resendIn > 0 || loading}>
            <Text style={[styles.link, (resendIn > 0 || loading) && { opacity: 0.5 }]}>
              {resendIn > 0 ? `Прислать заново через ${resendIn}с` : 'Прислать заново'}
            </Text>
          </Pressable>
        </>
      )}

      {step === 'register' && (
        <>
          <Text style={styles.hint}>Этот номер ещё не зарегистрирован. Заполни профиль:</Text>
          <Input label="Имя" value={displayName} onChangeText={setDisplayName} />
          <Input
            label="Username (латиница)"
            value={username}
            onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          />
          <Button
            title="Создать аккаунт"
            onPress={verify}
            loading={loading}
            disabled={!username.trim() || !displayName.trim() || username.length < 3}
          />
        </>
      )}

      <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
        Войти по email
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff5f9' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, color: '#3d1a28' },
  hint: { color: '#8c6471', marginBottom: 12, fontSize: 14 },
  link: { marginTop: 16, color: '#e84e76', fontWeight: '600', textAlign: 'center' },
  linkInline: { color: '#e84e76', fontWeight: '600' },
});
