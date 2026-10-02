import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, YStack } from 'tamagui';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

/** Standard-Container für alle Screens: Safe Area, Theme-Hintergrund, 16px Padding. */
export function Screen({ children, scroll = true }: ScreenProps) {
  const content = (
    <YStack flex={1} p="$4" gap="$4">
      {children}
    </YStack>
  );
  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {scroll ? <ScrollView contentContainerStyle={{ grow: 1 }}>{content}</ScrollView> : content}
      </SafeAreaView>
    </YStack>
  );
}
