import { useTranslation } from 'react-i18next';

import { Placeholder } from '@/components/Placeholder';

export default function IndexScreen() {
  const { t } = useTranslation();
  return <Placeholder title={t('generator.title')} />;
}
