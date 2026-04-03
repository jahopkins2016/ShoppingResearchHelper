import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Friend = {
  id: string;
  friend_id: string;
  display_name: string | null;
  email: string | null;
};

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchFriends();
  }, []);

  async function fetchFriends() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('friends')
      .select('id, friend_id, profiles:friend_id(display_name, email)')
      .eq('user_id', user.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        friend_id: row.friend_id,
        display_name: row.profiles?.display_name ?? null,
        email: row.profiles?.email ?? null,
      }));
      setFriends(mapped);
    }
    setLoading(false);
  }

  async function syncFriends() {
    setSyncing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSyncing(false); return; }

    // Find users from collection_shares
    const { data: sharedBy } = await supabase
      .from('collection_shares')
      .select('shared_with_user_id')
      .eq('shared_by', user.id)
      .not('shared_with_user_id', 'is', null);

    const { data: sharedWith } = await supabase
      .from('collection_shares')
      .select('shared_by')
      .eq('shared_with_user_id', user.id);

    const friendIds = new Set<string>();
    (sharedBy ?? []).forEach((r: any) => {
      if (r.shared_with_user_id && r.shared_with_user_id !== user.id) {
        friendIds.add(r.shared_with_user_id);
      }
    });
    (sharedWith ?? []).forEach((r: any) => {
      if (r.shared_by && r.shared_by !== user.id) {
        friendIds.add(r.shared_by);
      }
    });

    // Get existing friend IDs to avoid duplicates
    const existingIds = new Set(friends.map((f) => f.friend_id));
    const newFriendIds = [...friendIds].filter((fid) => !existingIds.has(fid));

    if (newFriendIds.length === 0) {
      Alert.alert('Up to date', 'No new friends found from your shared collections.');
      setSyncing(false);
      return;
    }

    const rows = newFriendIds.map((fid) => ({ user_id: user.id, friend_id: fid }));
    const { error } = await supabase.from('friends').insert(rows);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Synced', `Added ${newFriendIds.length} new friend(s).`);
      fetchFriends();
    }
    setSyncing(false);
  }

  async function removeFriend(friendRowId: string) {
    Alert.alert('Remove Friend', 'Are you sure you want to remove this friend?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('friends').delete().eq('id', friendRowId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setFriends((prev) => prev.filter((f) => f.id !== friendRowId));
          }
        },
      },
    ]);
  }

  function getInitial(friend: Friend): string {
    const name = friend.display_name || friend.email || '?';
    return name.charAt(0).toUpperCase();
  }

  const renderFriend = useCallback(({ item }: { item: Friend }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(item)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.display_name || 'Unknown'}</Text>
          {item.email && <Text style={styles.cardEmail}>{item.email}</Text>}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push('/messages')}
          activeOpacity={0.8}
        >
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFriend(item.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Friends</Text>
            <Text style={styles.pageSubtitle}>People you've connected with through collections.</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={syncFriends}
              activeOpacity={0.9}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.syncButtonText}>Sync Friends</Text>
              )}
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptySubtext}>
              Share a collection with someone or tap "Sync Friends" to discover connections.
            </Text>
          </View>
        }
        renderItem={renderFriend}
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

  syncButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  syncButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#191c1d' },
  cardEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  messageButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  messageButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  removeButton: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeButtonText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
