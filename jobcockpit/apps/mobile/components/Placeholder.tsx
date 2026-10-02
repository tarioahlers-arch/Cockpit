import { useTranslation } from 'react-i18next';
import { Paragraph } from 'tamagui';

import { Heading } from '@/components/Heading';
import { Screen } from '@/components/Screen';

/** Platzhalter für Screens, die in späteren Phasen gebaut werden. */
export function Placeholder({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <Heading>{title}</Heading>
      <Paragraph color="$colorMuted">{t('common.comingSoon')}</Paragraph>
    </Screen>
  );
}
