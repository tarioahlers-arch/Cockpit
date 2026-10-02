import { useTranslation } from 'react-i18next';

import { Placeholder } from '@/components/Placeholder';

export default function CareersScreen() {
  const { t } = useTranslation();
  return <Placeholder title={t('careers.title')} />;
}
