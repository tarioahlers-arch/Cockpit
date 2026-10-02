import { Button, type ButtonProps } from 'tamagui';

import { MIN_TOUCH_TARGET } from '@/lib/theme';

interface PrimaryButtonProps extends Omit<ButtonProps, 'accessibilityLabel'> {
  /** Pflicht für VoiceOver/TalkBack. */
  accessibilityLabel: string;
}

export function PrimaryButton({ accessibilityLabel, ...props }: PrimaryButtonProps) {
  return (
    <Button
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      minH={MIN_TOUCH_TARGET}
      bg="$primary"
      color="$onPrimary"
      pressStyle={{ bg: '$primaryStrong' }}
      {...props}
    />
  );
}
