import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TasksStack from './TasksStack';
import MyTasksStack from './MyTasksStack';
import ChatStack from './ChatStack';
import ProfileStack from './ProfileStack';
import { fetchNotifications } from '../api/notifications';
import { useSocket } from '../context/SocketContext';
import { colors } from '../constants/theme';
import type { MainTabParamList } from './types';
import type { AppNotification } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function MainTabs() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });

  // Keep the Profil tab's unread badge live, per docs/API_CONTRACT.md's
  // `notification` socket event, without requiring ProfileScreen to be mounted.
  useEffect(() => {
    if (!socket) return;
    function onNotification(_notification: AppNotification) {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [socket, queryClient]);

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="TasksTab"
        component={TasksStack}
        options={{ title: 'Aufgaben', tabBarIcon: ({ color }) => <TabIcon emoji="🗂️" color={color} /> }}
      />
      <Tab.Screen
        name="MyTasksTab"
        component={MyTasksStack}
        options={{ title: 'Meine Aufgaben', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ title: 'Nachrichten', tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} /> }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
