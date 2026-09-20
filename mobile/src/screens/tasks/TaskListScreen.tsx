import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchTasks, TaskListResponse } from '../../api/tasks';
import { fetchCategories } from '../../api/categories';
import { GERMAN_CITIES } from '../../constants/cities';
import { colors, radius, spacing } from '../../constants/theme';
import TaskCard from '../../components/TaskCard';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import SelectField from '../../components/SelectField';
import type { TasksStackParamList } from '../../navigation/types';
import { eurosToCents, centsToEuroInput } from '../../utils/money';

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskList'>;

const PAGE_SIZE = 10;

export default function TaskListScreen({ navigation }: Props) {
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Draft values edited inside the filter modal, applied on "Anwenden".
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(categoryId);
  const [draftCity, setDraftCity] = useState<string | null>(city);
  const [draftMin, setDraftMin] = useState(centsToEuroInput(minBudget));
  const [draftMax, setDraftMax] = useState(centsToEuroInput(maxBudget));

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const filters = useMemo(
    () => ({ q: appliedQ || undefined, categoryId: categoryId ?? undefined, city: city ?? undefined, minBudget: minBudget ?? undefined, maxBudget: maxBudget ?? undefined }),
    [appliedQ, categoryId, city, minBudget, maxBudget]
  );

  const tasksQuery = useInfiniteQuery<TaskListResponse>({
    queryKey: ['tasks', filters],
    queryFn: ({ pageParam }) => fetchTasks({ ...filters, page: pageParam as number, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  const tasks = tasksQuery.data?.pages.flatMap((page) => page.tasks) ?? [];
  const categoryOptions = (categoriesQuery.data?.categories ?? []).map((c) => ({ label: c.name, value: c.id }));
  const cityOptions = GERMAN_CITIES.map((c) => ({ label: c, value: c }));

  const activeFilterCount = [categoryId, city, minBudget, maxBudget].filter((v) => v !== null && v !== undefined).length;

  function openFilters() {
    setDraftCategoryId(categoryId);
    setDraftCity(city);
    setDraftMin(centsToEuroInput(minBudget));
    setDraftMax(centsToEuroInput(maxBudget));
    setFilterModalVisible(true);
  }

  function applyFilters() {
    setCategoryId(draftCategoryId || null);
    setCity(draftCity || null);
    setMinBudget(draftMin ? eurosToCents(draftMin) : null);
    setMaxBudget(draftMax ? eurosToCents(draftMax) : null);
    setFilterModalVisible(false);
  }

  function resetFilters() {
    setDraftCategoryId(null);
    setDraftCity(null);
    setDraftMin('');
    setDraftMax('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextField
          placeholder="Aufgaben durchsuchen…"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setAppliedQ(q)}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <Pressable style={styles.filterButton} onPress={openFilters}>
          <Text style={styles.filterButtonText}>Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
        </Pressable>
      </View>

      {tasksQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : tasksQuery.isError ? (
        <EmptyState title="Aufgaben konnten nicht geladen werden" subtitle="Ziehe zum Aktualisieren nach unten." />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })} />
          )}
          refreshControl={
            <RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={() => tasksQuery.refetch()} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (tasksQuery.hasNextPage && !tasksQuery.isFetchingNextPage) tasksQuery.fetchNextPage();
          }}
          ListFooterComponent={
            tasksQuery.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null
          }
          ListEmptyComponent={<EmptyState title="Keine Aufgaben gefunden" subtitle="Versuche andere Filter." />}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateTask')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={filterModalVisible} animationType="slide" transparent onRequestClose={() => setFilterModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterModalVisible(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>Aufgaben filtern</Text>
            <SelectField
              label="Kategorie"
              placeholder="Alle Kategorien"
              value={draftCategoryId}
              options={categoryOptions}
              onChange={setDraftCategoryId}
              allowClear
            />
            <SelectField
              label="Stadt"
              placeholder="Alle Städte"
              value={draftCity}
              options={cityOptions}
              onChange={setDraftCity}
              allowClear
            />
            <View style={styles.row}>
              <TextField
                label="Budget von (€)"
                keyboardType="decimal-pad"
                value={draftMin}
                onChangeText={setDraftMin}
                style={styles.half}
              />
              <TextField
                label="Budget bis (€)"
                keyboardType="decimal-pad"
                value={draftMax}
                onChangeText={setDraftMax}
                style={styles.half}
              />
            </View>
            <Button title="Filter anwenden" onPress={applyFilters} />
            <Button title="Zurücksetzen" variant="outline" onPress={resetFilters} style={{ marginTop: spacing.sm }} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, alignItems: 'flex-start' },
  searchInput: { flex: 1 },
  filterButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  filterButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  listContent: { padding: spacing.md, paddingBottom: 96 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: colors.white, fontSize: 30, lineHeight: 32, marginTop: -2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, paddingBottom: spacing.xl },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
