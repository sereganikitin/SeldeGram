export type RootStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Verify: { email: string };
  Login: undefined;
  ChatList: undefined;
  NewChat: undefined;
  Chat: { chatId: string; title: string };
};
