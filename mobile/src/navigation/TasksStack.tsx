import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TaskListScreen from '../screens/tasks/TaskListScreen';
import CreateTaskScreen from '../screens/tasks/CreateTaskScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import { colors } from '../constants/theme';
import type { TasksStackParamList } from './types';

const Stack = createNativeStackNavigator<TasksStackParamList>();

export default function TasksStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="TaskList" component={TaskListScreen} options={{ title: 'Aufgaben' }} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'Neue Aufgabe' }} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Aufgabe' }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Profil' }} />
    </Stack.Navigator>
  );
}
