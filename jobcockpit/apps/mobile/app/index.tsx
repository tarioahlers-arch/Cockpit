import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth';

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? '/(tabs)' : '/(auth)/welcome'} />;
}
