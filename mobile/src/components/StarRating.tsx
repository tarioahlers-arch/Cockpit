import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
}

/** Interactive when onChange is provided, read-only display otherwise. */
export default function StarRating({ rating, onChange, size = 24 }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((star) =>
        onChange ? (
          <Pressable key={star} onPress={() => onChange(star)} hitSlop={6}>
            <Text style={{ fontSize: size, color: star <= rating ? colors.star : colors.border }}>★</Text>
          </Pressable>
        ) : (
          <Text key={star} style={{ fontSize: size, color: star <= Math.round(rating) ? colors.star : colors.border }}>
            ★
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
});
