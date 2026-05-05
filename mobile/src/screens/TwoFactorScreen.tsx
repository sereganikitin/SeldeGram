import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ShieldCheck, ShieldOff } from 'lucide-react-native';
import { RootStackParamList } from '../navigation';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../api';
import { useAuth } from '../store/auth';
import { useColors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TwoFactor'>;

export function TwoFactorScreen({ navigation }: Props) {
  const colors = useColors();
  const me = useAuth((s) => s.user);
  const fetchMe = useAuth((s) => s.fetchMe);
  const enabled = !!me?.totpEnabled;

  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/2fa/start');
      setSecret(data.secret);
      setOtpauth(data.otpauth);
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      await api.post('/auth/2fa/confirm', { code });
      await fetchMe();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code });
      await fetchMe();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message ?? 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 20 }}>
      <Text style={[styles.title, { color: colors.text }]}>Двухфакторная аутентификация</Text>

      {!enabled && !secret && (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Включите 2FA, и при входе будет нужен 6-значный код из приложения вроде Google Authenticator, Authy или 1Password.
          </Text>
          <Button title="Начать настройку" onPress={start} loading={loading} />
        </>
      )}

      {!enabled && secret && otpauth && (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Отсканируйте QR в приложении-аутентификаторе или введите секрет вручную.
          </Text>
          <Image
            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauth)}` }}
            style={styles.qr}
          />
          <View style={styles.secretBox}>
            <Text style={styles.secretText}>{secret}</Text>
          </View>
          <Input
            label="Код из приложения"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\s+/g, ''))}
            keyboardType="number-pad"
            maxLength={8}
          />
          <Button title="Подтвердить и включить" onPress={confirm} loading={loading} />
        </>
      )}

      {enabled && (
        <>
          <View style={styles.statusRow}>
            <ShieldCheck size={20} color="#16a34a" />
            <Text style={[styles.hint, { color: colors.textMuted, marginBottom: 0 }]}>
              2FA включена. Чтобы отключить, введите текущий код.
            </Text>
          </View>
          <Input
            label="Код из приложения"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\s+/g, ''))}
            keyboardType="number-pad"
            maxLength={8}
          />
          <Button title="Отключить 2FA" variant="secondary" onPress={disable} loading={loading} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  hint: { fontSize: 14, marginBottom: 16 },
  qr: { width: 220, height: 220, alignSelf: 'center', marginBottom: 12 },
  secretBox: { backgroundColor: '#ffe8f0', padding: 12, borderRadius: 8, marginBottom: 12 },
  secretText: { fontFamily: 'monospace', fontSize: 13, textAlign: 'center', color: '#3d1a28' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
});
