import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Conversation');

  useEffect(() => {
    if (id) {
      init();
    }
  }, [id]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Get partner name
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, profiles:user_id(display_name, email)')
      .eq('conversation_id', id)
      .neq('user_id', user.id)
      .limit(1);

    const partner = (participants?.[0] as any)?.profiles;
    if (partner) {
      setPartnerName(partner.display_name || partner.email || 'Conversation');
    }

    await fetchMessages(user.id);
  }

  async function fetchMessages(currentUserId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setMessages(data ?? []);
      markAsRead(data ?? [], currentUserId);
    }
    setLoading(false);
  }

  async function markAsRead(msgs: Message[], currentUserId: string) {
    const unread = msgs.filter(
      (m) => m.sender_id !== currentUserId && !m.read_at
    );
    if (unread.length === 0) return;

    const ids = unread.map((m) => m.id);
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !userId) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: userId,
      content: text,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setInputText('');
      // Update conversation's updated_at and last_message
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString(), last_message: text })
        .eq('id', id);
      // Re-fetch messages
      await fetchMessages(userId);
    }
    setSending(false);
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === userId;
    return (
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubblePartner]}>
        <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextPartner]}>
          {item.content}
        </Text>
        <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimePartner]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerTitle: partnerName }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={renderMessage}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendButtonText}>
              {sending ? '...' : '➤'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },

  messagesList: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },

  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleOwn: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    backgroundColor: '#e7e8e9',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextOwn: { color: '#ffffff' },
  bubbleTextPartner: { color: '#191c1d' },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimePartner: { color: '#64748b' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#64748b' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e7e8e9',
    backgroundColor: '#ffffff',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f3f4f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#191c1d',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#ffffff', fontSize: 18 },
});
