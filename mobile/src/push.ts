import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Чат, который сейчас открыт у пользователя — для подавления уведомлений из этого же чата.
let activeChatId: string | null = null;
export function setActiveChat(chatId: string | null) {
  activeChatId = chatId;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as
      | { chatId?: string; type?: string }
      | undefined;
    const isCurrent = data?.chatId && data.chatId === activeChatId;
    // call-пуши всегда показываем — это полноценный сигнал звонка
    const isCall = data?.type === 'call';
    return {
      shouldShowBanner: isCall || !isCurrent,
      shouldShowList: isCall || !isCurrent,
      shouldPlaySound: isCall || !isCurrent,
      shouldSetBadge: false,
    };
  },
});

export async function registerPushToken() {
  if (!Device.isDevice) {
    // Эмулятор/симулятор не поддерживается Expo Push
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    status = asked;
  }
  if (status !== 'granted') {
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
    // Отдельный канал для звонков — высокий приоритет, рингтон, vibration
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Звонки',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 500, 500, 500, 500],
      lightColor: '#ff7a99',
      bypassDnd: true,
    });
  }

  // Категория для входящего звонка с кнопками Принять/Отклонить
  await Notifications.setNotificationCategoryAsync('CALL', [
    {
      identifier: 'accept',
      buttonTitle: 'Принять',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'reject',
      buttonTitle: 'Отклонить',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResp.data;
    const deviceName = Device.deviceName ?? `${Device.osName ?? 'Device'}`;
    await api.post('/devices/push-token', { token, deviceName });
  } catch (e) {
    // молча — пуши не критичны для работы
  }
}
