import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['Bug Report', 'Feature Request', 'General', 'Complaint'] as const;
type Category = typeof CATEGORIES[number];

type FeedbackItem = {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
};

export default function FeedbackScreen() {
  const [category, setCategory] = useState<Category>('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, []);

  async function fetchFeedback() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('feedback')
      .select('id, category, message, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setFeedbackList(data ?? []);
    }
    setLoading(false);
  }

  async function submitFeedback() {
    const text = message.trim();
    if (!text) {
      Alert.alert('Required', 'Please enter a message.');
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      category,
      message: text,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
      setMessage('');
      setCategory('General');
      fetchFeedback();
    }
    setSubmitting(false);
  }

  function showCategoryPicker() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...CATEGORIES],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setCategory(CATEGORIES[buttonIndex - 1]);
          }
        },
      );
    } else {
      // Android: cycle through categories or use Alert with buttons
      Alert.alert(
        'Select Category',
        undefined,
        CATEGORIES.map((cat) => ({
          text: cat,
          onPress: () => setCategory(cat),
        })),
      );
    }
  }

  function categoryColor(cat: string): string {
    switch (cat) {
      case 'Bug Report': return '#dc2626';
      case 'Feature Request': return '#2563eb';
      case 'Complaint': return '#ea580c';
      default: return '#64748b';
    }
  }

  function statusColor(status: string): string {
    switch (status) {
      case 'resolved': return '#16a34a';
      case 'in_progress': return '#2563eb';
      default: return '#64748b';
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerTitle: 'Feedback' }} />
      <FlatList
        data={feedbackList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Feedback</Text>
            <Text style={styles.pageSubtitle}>Help us improve SaveIt.</Text>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={showCategoryPicker}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerText}>{category}</Text>
                <Text style={styles.pickerChevron}>▾</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Describe your feedback..."
                placeholderTextColor="#94a3b8"
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submitFeedback}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Feedback</Text>
                )}
              </TouchableOpacity>
            </View>

            {feedbackList.length > 0 && (
              <Text style={styles.sectionTitle}>Previous Feedback</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No feedback submitted yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: categoryColor(item.category) + '18' }]}>
                <Text style={[styles.badgeText, { color: categoryColor(item.category) }]}>
                  {item.category}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '18' }]}>
                <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                  {item.status || 'pending'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMessage} numberOfLines={3}>{item.message}</Text>
            <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  list: { paddingHorizontal: 24, paddingBottom: 100 },

  pageTitle: { fontSize: 28, fontWeight: '800', color: '#191c1d', letterSpacing: -0.5, marginTop: 8 },
  pageSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 20, fontWeight: '500' },

  form: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#191c1d', marginBottom: 6, marginTop: 12 },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: { fontSize: 15, color: '#191c1d', fontWeight: '500' },
  pickerChevron: { fontSize: 14, color: '#64748b' },
  textInput: {
    backgroundColor: '#f3f4f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#191c1d',
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#191c1d',
    marginBottom: 12,
  },

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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardMessage: { fontSize: 14, color: '#191c1d', lineHeight: 20, marginBottom: 8 },
  cardDate: { fontSize: 12, color: '#64748b' },

  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 14, color: '#64748b' },
});
