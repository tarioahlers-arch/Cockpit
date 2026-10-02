import { useTranslation } from 'react-i18next';

import { Placeholder } from '@/components/Placeholder';

// Phase 2: E-Mail/Passwort, Sign in with Apple, Google, GDPR-Consent.
export default function SignIn() {
  const { t } = useTranslation();
  return <Placeholder title={t('auth.signInTitle')} />;
}
