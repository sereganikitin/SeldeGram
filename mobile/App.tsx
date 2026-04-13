import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useTheme, useColors, useIsDark } from './src/theme';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from './src/navigation';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { VerifyScreen } from './src/screens/VerifyScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { NewChatScreen } from './src/screens/NewChatScreen';
import { NewGroupScreen } from './src/screens/NewGroupScreen';
import { NewChannelScreen } from './src/screens/NewChannelScreen';
import { FindChannelScreen } from './src/screens/FindChannelScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { GroupInfoScreen } from './src/screens/GroupInfoScreen';
import { UserInfoScreen } from './src/screens/UserInfoScreen';
import { ForwardScreen } from './src/screens/ForwardScreen';
import { StickersScreen } from './src/screens/StickersScreen';
import { CreateStickerPackScreen } from './src/screens/CreateStickerPackScreen';
import { StickerPackScreen } from './src/screens/StickerPackScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { WallpaperPickerScreen } from './src/screens/WallpaperPickerScreen';
import { BlockListScreen } from './src/screens/BlockListScreen';
import { ThreadScreen } from './src/screens/ThreadScreen';
import { useAuth } from './src/store/auth';
import { useWs } from './src/store/ws';
import { registerPushToken } from './src/push';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const wsConnect = useWs((s) => s.connect);
  const wsDisconnect = useWs((s) => s.disconnect);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const themeHydrated = useTheme((s) => s.hydrated);
  const colors = useColors();
  const isDark = useIsDark();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    hydrate();
    hydrateTheme();
  }, [hydrate, hydrateTheme]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { chatId?: string } | undefined;
      if (data?.chatId && navRef.current?.isReady()) {
        navRef.current.navigate('Chat', { chatId: data.chatId, title: 'Чат' });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (user) {
      wsConnect();
      registerPushToken();
    } else {
      wsDisconnect();
    }
  }, [user, wsConnect, wsDisconnect]);

  if (!hydrated || !themeHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  const navTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } };

  return (
    <SafeAreaProvider>
    <NavigationContainer ref={navRef} theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Чаты' }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Новый чат' }} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: 'Новая группа' }} />
            <Stack.Screen name="NewChannel" component={NewChannelScreen} options={{ title: 'Новый канал' }} />
            <Stack.Screen name="FindChannel" component={FindChannelScreen} options={{ title: 'Найти канал' }} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Информация' }} />
            <Stack.Screen name="UserInfo" component={UserInfoScreen} options={{ title: 'Профиль' }} />
            <Stack.Screen name="Forward" component={ForwardScreen} options={{ title: 'Переслать' }} />
            <Stack.Screen name="Stickers" component={StickersScreen} options={{ title: 'Стикеры' }} />
            <Stack.Screen name="CreateStickerPack" component={CreateStickerPackScreen} options={{ title: 'Новый пак' }} />
            <Stack.Screen name="StickerPack" component={StickerPackScreen} options={{ title: 'Пак' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
            <Stack.Screen name="WallpaperPicker" component={WallpaperPickerScreen} options={{ title: 'Обои' }} />
            <Stack.Screen name="BlockList" component={BlockListScreen} options={{ title: 'Заблокированные' }} />
            <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: 'Комментарии' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: 'Подтверждение' }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
