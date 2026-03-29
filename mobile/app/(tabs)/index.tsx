import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const COLUMN_GAP = 16;
const PADDING = 24;
const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_WIDTH = (SCREEN_WIDTH - PADDING * 2 - COLUMN_GAP) / 2;

type Collection = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  cover_image_url?: string | null;
  item_count?: number;
};

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All Collections');
  const router = useRouter();

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setCollections(data ?? []);
    }
    setLoading(false);
  }

  async function createCollection() {
    Alert.prompt('New Collection', 'Enter a name for your collection', async (name) => {
      if (!name?.trim()) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('collections').insert({
        name: name.trim(),
        user_id: user?.id,
      });
      if (error) Alert.alert('Error', error.message);
      else fetchCollections();
    });
  }

  const filters = ['All Collections', 'Recent', 'Favorites'];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.headerSection}>
              <Text style={styles.pageTitle}>My Collections</Text>
              <Text style={styles.pageSubtitle}>Your private archive of inspiration.</Text>
            </View>
            <FlatList
              data={filters}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chip, activeFilter === item && styles.chipActive]}
                  onPress={() => setActiveFilter(item)}
                >
                  <Text style={[styles.chipText, activeFilter === item && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>Build your gallery</Text>
            <Text style={styles.emptySubtext}>
              Start saving links, photos, and notes to create your first collection.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={createCollection}>
              <Text style={styles.emptyButtonText}>Save First Item</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { width: COLUMN_WIDTH },
              index % 2 === 1 && { marginTop: 32 },
            ]}
            onPress={() => router.push(`/collection/${item.id}`)}
            activeOpacity={0.95}
          >
            <View style={[styles.cardImage, index % 2 === 0 ? styles.cardImageTall : styles.cardImageSquare]}>
              {item.cover_image_url ? (
                <Image source={{ uri: item.cover_image_url }} style={styles.cardImageInner} />
              ) : (
                <View style={styles.cardImagePlaceholder} />
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.item_count ?? 0} items</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={createCollection} activeOpacity={0.9}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  list: { paddingHorizontal: PADDING, paddingBottom: 100 },
  row: { justifyContent: 'space-between' },

  headerSection: { marginBottom: 16, marginTop: 8 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: '#434655', marginTop: 4, fontWeight: '500' },

  chipRow: { gap: 8, marginBottom: 20, paddingRight: 24 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#e7e8e9',
  },
  chipActive: { backgroundColor: '#dbe1ff' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#434655' },
  chipTextActive: { color: '#00174b' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardImage: { width: '100%', backgroundColor: '#edeeef', overflow: 'hidden' },
  cardImageTall: { aspectRatio: 4 / 5 },
  cardImageSquare: { aspectRatio: 1 },
  cardImageInner: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardImagePlaceholder: { flex: 1, backgroundColor: '#e7e8e9' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#191c1d' },
  cardMeta: { fontSize: 12, color: '#434655', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, backgroundColor: '#f3f4f5', borderRadius: 16, marginTop: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIconText: { fontSize: 24, color: '#004ac6' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#434655', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyButton: {
    backgroundColor: '#2563eb',
    borderRadius: 9999,
    paddingHorizontal: 28,
    paddingVertical: 12,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#004ac6',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
