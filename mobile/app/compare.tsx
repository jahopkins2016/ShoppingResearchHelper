import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../lib/supabase';

type Comparison = {
  id: string;
  name: string;
  created_at: string;
};

type ComparisonItem = {
  id: string;
  item_id: string;
  title: string | null;
  image_url: string | null;
  price: string | null;
  brand: string | null;
  rating: string | null;
};

export default function CompareScreen() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchComparisons();
  }, []);

  async function fetchComparisons() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('item_comparisons')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setComparisons(data ?? []);
    }
    setLoading(false);
  }

  async function createComparison() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const name = `Comparison ${comparisons.length + 1}`;
    const { error } = await supabase.from('item_comparisons').insert({
      user_id: user.id,
      name,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      fetchComparisons();
    }
  }

  async function selectComparison(compId: string) {
    setSelectedId(compId);
    setItemsLoading(true);

    const { data, error } = await supabase
      .from('comparison_items')
      .select('id, item_id, items(title, image_url, price, brand, rating)')
      .eq('comparison_id', compId);

    if (error) {
      Alert.alert('Error', error.message);
      setItemsLoading(false);
      return;
    }

    const mapped = (data ?? []).map((row: any) => ({
      id: row.id,
      item_id: row.item_id,
      title: row.items?.title ?? null,
      image_url: row.items?.image_url ?? null,
      price: row.items?.price ?? null,
      brand: row.items?.brand ?? null,
      rating: row.items?.rating ?? null,
    }));
    setComparisonItems(mapped);
    setItemsLoading(false);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerTitle: 'Compare' }} />
      <FlatList
        data={comparisons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Compare Items</Text>
            <Text style={styles.pageSubtitle}>Side-by-side product comparisons.</Text>
            <TouchableOpacity
              style={styles.newButton}
              onPress={createComparison}
              activeOpacity={0.9}
            >
              <Text style={styles.newButtonText}>+ New Comparison</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No comparisons yet</Text>
            <Text style={styles.emptySubtext}>
              Create a comparison to put products side by side.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <TouchableOpacity
              style={[styles.card, selectedId === item.id && styles.cardSelected]}
              onPress={() => selectComparison(item.id)}
              activeOpacity={0.95}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
            </TouchableOpacity>
            {selectedId === item.id && (
              <View style={styles.itemsContainer}>
                {itemsLoading ? (
                  <ActivityIndicator size="small" color="#2563eb" style={{ padding: 20 }} />
                ) : comparisonItems.length === 0 ? (
                  <Text style={styles.noItems}>No items in this comparison yet.</Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.itemsScroll}
                  >
                    {comparisonItems.map((ci) => (
                      <View key={ci.id} style={styles.itemCard}>
                        {ci.image_url ? (
                          <Image source={{ uri: ci.image_url }} style={styles.itemImage} />
                        ) : (
                          <View style={[styles.itemImage, styles.itemImagePlaceholder]} />
                        )}
                        <Text style={styles.itemTitle} numberOfLines={2}>
                          {ci.title || 'Untitled'}
                        </Text>
                        {ci.price && <Text style={styles.itemPrice}>{ci.price}</Text>}
                        {ci.brand && <Text style={styles.itemMeta}>Brand: {ci.brand}</Text>}
                        {ci.rating && <Text style={styles.itemMeta}>Rating: {ci.rating}</Text>}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },

  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5, marginTop: 8 },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 16, fontWeight: '500' },

  newButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  newButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected: { borderWidth: 2, borderColor: '#2563eb' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#191c1d' },
  cardDate: { fontSize: 12, color: '#64748b', marginTop: 4 },

  itemsContainer: {
    marginBottom: 16,
    marginTop: -4,
  },
  noItems: { fontSize: 13, color: '#64748b', paddingLeft: 4, paddingBottom: 8 },
  itemsScroll: { paddingVertical: 8, gap: 12 },
  itemCard: {
    width: 160,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  itemImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: '#edeeef',
    marginBottom: 8,
  },
  itemImagePlaceholder: { backgroundColor: '#e7e8e9' },
  itemTitle: { fontSize: 13, fontWeight: '600', color: '#191c1d', marginBottom: 4 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#16a34a', marginBottom: 2 },
  itemMeta: { fontSize: 11, color: '#64748b', marginBottom: 1 },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
