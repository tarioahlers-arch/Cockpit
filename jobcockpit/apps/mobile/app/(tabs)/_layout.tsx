import { Tabs } from 'expo-router';
import { Briefcase, Building2, FileText, Settings, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'tamagui';

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const active = theme.primary?.val as string | undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarStyle: { backgroundColor: theme.backgroundStrong?.val as string | undefined },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.generator'),
          tabBarAccessibilityLabel: t('tabs.generator'),
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: t('tabs.tracker'),
          tabBarAccessibilityLabel: t('tabs.tracker'),
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="careers"
        options={{
          title: t('tabs.careers'),
          tabBarAccessibilityLabel: t('tabs.careers'),
          tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarAccessibilityLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
