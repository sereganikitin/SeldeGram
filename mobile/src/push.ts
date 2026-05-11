import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
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
    const isCall = data?.type === 'call';
    // Если приложение в foreground — call:incoming уже придёт через WS
    // и CallOverlay сам отрисуется. Баннер дублировать не нужно.
    const isForeground = AppState.currentState === 'active';
    if (isCall && isForeground) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
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
    // Отдельный канал для звонков — высокий приоритет, длинный рингтон,
    // длительная вибрация, баннер на lockscreen.
    // Внимание: имя файла должно совпадать с тем что зарегистрирован в
    // app.json expo-notifications.sounds (без префикса пути).
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Звонки',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'ringtone.mp3',
      // ~30 секунд непрерывной вибрации: 1с вибро / 0.4с пауза × повторно
      vibrationPattern: [
        0, 1000, 400, 1000, 400, 1000, 400, 1000, 400, 1000, 400,
        1000, 400, 1000, 400, 1000, 400, 1000, 400, 1000, 400, 1000,
      ],
      lightColor: '#ff7a99',
      enableLights: true,
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
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
