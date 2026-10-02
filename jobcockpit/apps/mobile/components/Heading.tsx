import { Text, type TextProps } from 'tamagui';

export function Heading(props: TextProps) {
  return (
    <Text
      fontFamily="$heading"
      fontSize="$8"
      color="$color"
      accessibilityRole="header"
      {...props}
    />
  );
}
