import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TasksStackParamList = {
  TaskList: undefined;
  CreateTask: undefined;
  TaskDetail: { taskId: string };
  PublicProfile: { userId: string };
};

export type MyTasksStackParamList = {
  MyTasksHome: undefined;
  TaskDetail: { taskId: string };
  PublicProfile: { userId: string };
};

export type ChatStackParamList = {
  Conversations: undefined;
  Chat: { conversationId: string; title: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Notifications: undefined;
  PublicProfile: { userId: string };
};

export type MainTabParamList = {
  TasksTab: NavigatorScreenParams<TasksStackParamList>;
  MyTasksTab: NavigatorScreenParams<MyTasksStackParamList>;
  ChatTab: NavigatorScreenParams<ChatStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};
