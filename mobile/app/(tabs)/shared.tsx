import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { supabase } from '../../lib/supabase';

type SharedCollection = {
  id: string;
  role: string;
  collections: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url?: string | null;
  };
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
};

const filters = ['All Shared', 'Editor Role', 'Viewer Only'];

export default function SharedScreen() {
  const [shares, setShares] = useState<SharedCollection[]>([]);
  const [activeFilter, setActiveFilter] = useState('All Shared');

  useEffect(() => {
    fetchShares();
  }, []);

  async function fetchShares() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('collection_shares')
      .select('id, role, collections(*), profiles:shared_by_user_id(display_name, avatar_url)')
      .eq('shared_with_user_id', user.id)
      .eq('status', 'accepted');
    setShares((data as any) ?? []);
  }

  const filtered = shares.filter((s) => {
    if (activeFilter === 'Editor Role') return s.role === 'editor';
    if (activeFilter === 'Viewer Only') return s.role === 'viewer';
    return true;
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Shared With Me</Text>
            <Text style={styles.pageSubtitle}>Collections curated by others, curated for you.</Text>
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
            <Text style={styles.emptyTitle}>Nothing shared yet.</Text>
            <Text style={styles.emptySubtext}>
              Collections others have shared with you will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.95}>
            {item.collections?.cover_image_url && (
              <Image source={{ uri: item.collections.cover_image_url }} style={styles.cardImage} />
            )}
            {!item.collections?.cover_image_url && (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
            )}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.collections?.name}</Text>
              <View style={styles.roleBadgeRow}>
                <View style={[styles.roleBadge, item.role === 'editor' ? styles.roleBadgeEditor : styles.roleBadgeViewer]}>
                  <Text style={[styles.roleBadgeText, item.role === 'editor' ? styles.roleBadgeTextEditor : styles.roleBadgeTextViewer]}>
                    {item.role === 'editor' ? 'EDITOR' : 'VIEWER'}
                  </Text>
                </View>
              </View>
              {item.profiles?.display_name && (
                <View style={styles.sharedBy}>
                  <View style={styles.sharedByAvatar}>
                    {item.profiles.avatar_url ? (
                      <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarFallback}>
                        {item.profiles.display_name.charAt(0)}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.sharedByLabel}>SHARED BY</Text>
                    <Text style={styles.sharedByName}>{item.profiles.display_name}</Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },

  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5, marginTop: 8 },
  pageSubtitle: { fontSize: 14, color: '#434655', marginTop: 4, marginBottom: 16, fontWeight: '500' },

  chipRow: { gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#e7e8e9',
  },
  chipActive: { backgroundColor: '#004ac6' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#434655' },
  chipTextActive: { color: '#ffffff' },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#434655', textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: '#edeeef',
  },
  cardImagePlaceholder: { backgroundColor: '#e7e8e9' },
  cardContent: { padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#191c1d', marginBottom: 6 },

  roleBadgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  roleBadgeEditor: { backgroundColor: 'rgba(0,74,198,0.1)' },
  roleBadgeViewer: { backgroundColor: 'rgba(73,92,149,0.1)' },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  roleBadgeTextEditor: { color: '#004ac6' },
  roleBadgeTextViewer: { color: '#495c95' },

  sharedBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f5',
  },
  sharedByAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#edeeef',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 32, height: 32 },
  avatarFallback: { fontSize: 14, fontWeight: '600', color: '#434655' },
  sharedByLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#434655' },
  sharedByName: { fontSize: 14, fontWeight: '500', color: '#191c1d' },
});
