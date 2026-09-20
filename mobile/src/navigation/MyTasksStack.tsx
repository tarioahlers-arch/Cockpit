import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyTasksScreen from '../screens/mytasks/MyTasksScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import { colors } from '../constants/theme';
import type { MyTasksStackParamList } from './types';

const Stack = createNativeStackNavigator<MyTasksStackParamList>();

export default function MyTasksStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="MyTasksHome" component={MyTasksScreen} options={{ title: 'Meine Aufgaben' }} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Aufgabe' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  );
}
