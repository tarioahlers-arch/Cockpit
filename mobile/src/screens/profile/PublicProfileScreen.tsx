import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getPublicUser, getUserReviews } from '../../api/users';
import { colors, radius, spacing } from '../../constants/theme';
import { formatCents } from '../../utils/money';
import Avatar from '../../components/Avatar';
import StarRating from '../../components/StarRating';
import EmptyState from '../../components/EmptyState';
import type { MyTasksStackParamList, ProfileStackParamList, TasksStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  TasksStackParamList | MyTasksStackParamList | ProfileStackParamList,
  'PublicProfile'
>;

export default function PublicProfileScreen({ route }: Props) {
  const { userId } = route.params;
  const userQuery = useQuery({ queryKey: ['publicUser', userId], queryFn: () => getPublicUser(userId) });
  const reviewsQuery = useQuery({ queryKey: ['userReviews', userId], queryFn: () => getUserReviews(userId) });

  if (userQuery.isLoading || !userQuery.data) {
    return (
      <View style={styles.centered}>
        {userQuery.isError ? <Text style={styles.mutedText}>Profil konnte nicht geladen werden.</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const { user } = userQuery.data;
  const reviews = reviewsQuery.data?.reviews ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} size={72} />
        <Text style={styles.name}>
          {user.firstName} {user.lastName}
        </Text>
        {user.city ? <Text style={styles.mutedText}>{user.city}</Text> : null}
        <View style={styles.ratingRow}>
          <StarRating rating={user.ratingAvg ?? 0} size={18} />
          <Text style={styles.mutedText}>
            {(user.ratingAvg ?? 0).toFixed(1)} ({user.ratingCount} Bewertungen)
          </Text>
        </View>
        {user.isTaskerOnboarded ? <Text style={styles.badge}>Helfer</Text> : null}
      </View>

      {user.bio ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Über mich</Text>
          <Text style={styles.body}>{user.bio}</Text>
        </View>
      ) : null}

      {user.isTaskerOnboarded ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Als Helfer</Text>
          {user.hourlyRate ? <Text style={styles.body}>Stundensatz: {formatCents(user.hourlyRate)}</Text> : null}
          {user.skills?.length ? (
            <View style={styles.skillsRow}>
              {user.skills.map((skill) => (
                <Text key={skill.id} style={styles.skillTag}>
                  {skill.name}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Bewertungen ({reviews.length})</Text>
        {reviews.length === 0 ? (
          <EmptyState title="Noch keine Bewertungen" />
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewRow}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StarRating rating={review.rating} size={14} />
                <Text style={styles.mutedText}>{new Date(review.createdAt).toLocaleDateString('de-DE')}</Text>
              </View>
              <Text style={styles.reviewerName}>
                {review.isAnonymous || !review.reviewer
                  ? 'Anonym'
                  : `${review.reviewer.firstName} ${review.reviewer.lastName}`}
              </Text>
              {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
              <Text style={styles.mutedText}>zur Aufgabe „{review.task.title}“</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  headerCard: { alignItems: 'center', padding: spacing.lg },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  badge: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  skillTag: {
    fontSize: 12,
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  reviewRow: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  reviewerName: { fontWeight: '700', color: colors.text, marginTop: 2 },
});
