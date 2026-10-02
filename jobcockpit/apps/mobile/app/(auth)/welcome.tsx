import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Paragraph, YStack } from 'tamagui';

import { Heading } from '@/components/Heading';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { PRICES_EUR } from '@/lib/pricing';
import { useSettingsStore } from '@/stores';

// Phase 2: Wird zu einem 3-Slide-Pager (Vision, Features, Preis-Transparenz).
export default function Welcome() {
  const { t } = useTranslation();
  const markWelcomeSeen = useSettingsStore((s) => s.markWelcomeSeen);

  const slides = [
    { title: t('welcome.slide1Title'), body: t('welcome.slide1Body') },
    { title: t('welcome.slide2Title'), body: t('welcome.slide2Body') },
    {
      title: t('welcome.slide3Title'),
      body: t('welcome.slide3Body', {
        monthly: PRICES_EUR.proMonthly.toFixed(2).replace('.', ','),
        annual: PRICES_EUR.proAnnual,
      }),
    },
  ];

  return (
    <Screen>
      <Heading>{t('common.appName')}</Heading>
      {slides.map((s) => (
        <YStack key={s.title} gap="$2">
          <Heading fontSize="$6">{s.title}</Heading>
          <Paragraph color="$colorMuted">{s.body}</Paragraph>
        </YStack>
      ))}
      <YStack flex={1} />
      <PrimaryButton
        accessibilityLabel={t('welcome.getStarted')}
        onPress={() => {
          markWelcomeSeen();
          router.push('/(auth)/sign-in');
        }}
      >
        {t('welcome.getStarted')}
      </PrimaryButton>
    </Screen>
  );
}
