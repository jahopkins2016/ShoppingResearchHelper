import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Conversation = {
  id: string;
  updated_at: string;
  partner_name: string | null;
  partner_email: string | null;
  last_message: string | null;
};

type Friend = {
  id: string;
  friend_id: string;
  display_name: string | null;
  email: string | null;
};

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: participantRows, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, conversations(id, updated_at, last_message)')
      .eq('user_id', user.id)
      .order('conversations(updated_at)', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // For each conversation, find the other participant
    const convos: Conversation[] = [];
    for (const row of participantRows ?? []) {
      const convo = (row as any).conversations;
      if (!convo) continue;

      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('user_id, profiles:user_id(display_name, email)')
        .eq('conversation_id', convo.id)
        .neq('user_id', user.id)
        .limit(1);

      const partner = (otherParticipants?.[0] as any)?.profiles;
      convos.push({
        id: convo.id,
        updated_at: convo.updated_at,
        last_message: convo.last_message,
        partner_name: partner?.display_name ?? null,
        partner_email: partner?.email ?? null,
      });
    }

    setConversations(convos);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }

  async function openNewMessageModal() {
    setShowNewModal(true);
    setFriendsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFriendsLoading(false); return; }

    const { data } = await supabase
      .from('friends')
      .select('id, friend_id, profiles:friend_id(display_name, email)')
      .eq('user_id', user.id);

    const mapped = (data ?? []).map((row: any) => ({
      id: row.id,
      friend_id: row.friend_id,
      display_name: row.profiles?.display_name ?? null,
      email: row.profiles?.email ?? null,
    }));
    setFriends(mapped);
    setFriendsLoading(false);
  }

  async function startConversation(friendUserId: string) {
    setShowNewModal(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if conversation already exists between these two users
    const { data: myConvos } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    const myConvoIds = (myConvos ?? []).map((c: any) => c.conversation_id);

    if (myConvoIds.length > 0) {
      const { data: existing } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', friendUserId)
        .in('conversation_id', myConvoIds)
        .limit(1);

      if (existing && existing.length > 0) {
        router.push(`/conversation/${existing[0].conversation_id}`);
        return;
      }
    }

    // Create new conversation
    const { data: newConvo, error } = await supabase
      .from('conversations')
      .insert({ created_by: user.id })
      .select('id')
      .single();

    if (error || !newConvo) {
      Alert.alert('Error', error?.message ?? 'Failed to create conversation.');
      return;
    }

    await supabase.from('conversation_participants').insert([
      { conversation_id: newConvo.id, user_id: user.id },
      { conversation_id: newConvo.id, user_id: friendUserId },
    ]);

    router.push(`/conversation/${newConvo.id}`);
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  }

  function getInitial(name: string | null, email: string | null): string {
    const val = name || email || '?';
    return val.charAt(0).toUpperCase();
  }

  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/conversation/${item.id}`)}
      activeOpacity={0.95}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {getInitial(item.partner_name, item.partner_email)}
        </Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.partner_name || item.partner_email || 'Unknown'}
          </Text>
          <Text style={styles.cardTime}>{formatTime(item.updated_at)}</Text>
        </View>
        {item.last_message && (
          <Text style={styles.cardPreview} numberOfLines={1}>
            {item.last_message}
          </Text>
        )}
      </View>
    </TouchableOpacity>
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
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Messages</Text>
            <Text style={styles.pageSubtitle}>Conversations with your friends.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation by tapping "New Message" below.
            </Text>
          </View>
        }
        renderItem={renderConversation}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={openNewMessageModal}
        activeOpacity={0.9}
      >
        <Text style={styles.fabText}>+ New Message</Text>
      </TouchableOpacity>

      {/* New message modal - pick a friend */}
      <Modal visible={showNewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Message</Text>
              <TouchableOpacity onPress={() => setShowNewModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {friendsLoading ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
            ) : friends.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.emptySubtext}>
                  No friends to message. Add friends from the Friends tab first.
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.friendRow}
                    onPress={() => startConversation(item.friend_id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>
                        {getInitial(item.display_name, item.email)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.friendName}>{item.display_name || 'Unknown'}</Text>
                      {item.email && <Text style={styles.friendEmail}>{item.email}</Text>}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },

  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5, marginTop: 8 },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 20, fontWeight: '500' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#191c1d', flex: 1, marginRight: 8 },
  cardTime: { fontSize: 12, color: '#64748b' },
  cardPreview: { fontSize: 13, color: '#64748b', marginTop: 4 },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignSelf: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#191c1d' },
  modalClose: { fontSize: 20, color: '#64748b', padding: 4 },
  modalEmpty: { alignItems: 'center', paddingVertical: 40 },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f5',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendAvatarText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  friendName: { fontSize: 15, fontWeight: '600', color: '#191c1d' },
  friendEmail: { fontSize: 13, color: '#64748b', marginTop: 1 },
});
