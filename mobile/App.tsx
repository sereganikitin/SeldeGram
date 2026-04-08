import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from './src/navigation';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { VerifyScreen } from './src/screens/VerifyScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { NewChatScreen } from './src/screens/NewChatScreen';
import { NewGroupScreen } from './src/screens/NewGroupScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { GroupInfoScreen } from './src/screens/GroupInfoScreen';
import { UserInfoScreen } from './src/screens/UserInfoScreen';
import { ForwardScreen } from './src/screens/ForwardScreen';
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
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      <StatusBar style="auto" />
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Чаты' }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Новый чат' }} />
            <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: 'Новая группа' }} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Информация' }} />
            <Stack.Screen name="UserInfo" component={UserInfoScreen} options={{ title: 'Профиль' }} />
            <Stack.Screen name="Forward" component={ForwardScreen} options={{ title: 'Переслать' }} />
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
  );
}
