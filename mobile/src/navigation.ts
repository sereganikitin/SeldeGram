export type RootStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Verify: { email: string };
  Login: undefined;
  ChatList: undefined;
  NewChat: undefined;
  NewGroup: undefined;
  Chat: { chatId: string; title: string };
  GroupInfo: { chatId: string };
  UserInfo: { chatId: string };
  Forward: { messageId: string };
};
