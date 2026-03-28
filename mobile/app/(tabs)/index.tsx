import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Collection = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No collections yet.</Text>
            <Text style={styles.emptySubtext}>Tap + to create your first one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/collection/${item.id}`)}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.description && (
              <Text style={styles.cardDescription}>{item.description}</Text>
            )}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={createCollection}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 80 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cardDescription: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
