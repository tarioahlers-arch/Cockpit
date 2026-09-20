import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

export default function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen label="HelferHand wird geladen…" />;
  }

  return <NavigationContainer>{token ? <MainTabs /> : <AuthStack />}</NavigationContainer>;
}
