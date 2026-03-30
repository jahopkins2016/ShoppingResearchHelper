import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Dimensions,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 24;
const IMAGE_SIZE = 80;

type Item = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cached_image_path: string | null;
  price: string | null;
  currency: string | null;
  site_name: string | null;
  site_favicon_url: string | null;
  enrichment_status: string;
  price_drop_seen: boolean;
  lowest_price: string | null;
  created_at: string;
};

type PriceHistoryRow = {
  id: string;
  price: string | null;
  currency: string | null;
  checked_at: string;
};

export default function CollectionItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionName, setCollectionName] = useState('');

  const [priceSheetVisible, setPriceSheetVisible] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [priceSheetItemId, setPriceSheetItemId] = useState<string | null>(null);
  const [priceSheetLoading, setPriceSheetLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCollection();
      fetchItems();
    }
  }, [id]);

  async function fetchCollection() {
    const { data } = await supabase
      .from('collections')
      .select('name')
      .eq('id', id)
      .single();
    if (data) setCollectionName(data.name);
  }

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('collection_id', id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      const fetched = data ?? [];
      setItems(fetched);
      retryStaleEnrichments(fetched);
    }
    setLoading(false);
  }

  function retryStaleEnrichments(fetchedItems: Item[]) {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    const stale = fetchedItems.filter(
      (i) => i.enrichment_status === 'pending' && i.created_at < thirtySecondsAgo
    );
    for (const item of stale) {
      supabase.functions.invoke('enrich-item', {
        body: { item_id: item.id },
      });
    }
  }

  async function handleAddItem() {
    const trimmed = addUrl.trim();
    if (!trimmed) return;

    setAddSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('items')
        .insert({
          url: trimmed,
          collection_id: id,
          user_id: user.id,
          enrichment_status: 'pending',
        })
        .select()
        .single();

      if (error || !data) {
        Alert.alert('Error', error?.message || 'Failed to save item');
        return;
      }

      setItems((prev) => [data as Item, ...prev]);

      supabase.functions.invoke('enrich-item', {
        body: { item_id: data.id },
      });

      setAddUrl('');
      setShowAddModal(false);
    } finally {
      setAddSaving(false);
    }
  }

  const openPriceSheet = useCallback(async (itemId: string) => {
    setPriceSheetItemId(itemId);
    setPriceSheetVisible(true);
    setPriceSheetLoading(true);

    const { data } = await supabase
      .from('price_history')
      .select('*')
      .eq('item_id', itemId)
      .order('checked_at', { ascending: false });

    setPriceHistory(data ?? []);
    setPriceSheetLoading(false);
  }, []);

  async function dismissPriceDrop() {
    if (priceSheetItemId) {
      await supabase
        .from('items')
        .update({ price_drop_seen: true })
        .eq('id', priceSheetItemId);
      setItems((prev) =>
        prev.map((i) =>
          i.id === priceSheetItemId ? { ...i, price_drop_seen: true } : i
        )
      );
    }
    setPriceSheetVisible(false);
    setPriceHistory([]);
    setPriceSheetItemId(null);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function renderItem({ item }: { item: Item }) {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.95}>
        <View style={styles.cardRow}>
          {(item.cached_image_path || item.image_url) ? (
            <Image source={{ uri: (item.cached_image_path || item.image_url)! }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
          )}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || item.url}
            </Text>
            <View style={styles.siteRow}>
              {item.site_favicon_url ? (
                <Image source={{ uri: item.site_favicon_url }} style={styles.favicon} />
              ) : null}
              <Text style={styles.siteName} numberOfLines={1}>
                {item.site_name || new URL(item.url).hostname}
              </Text>
            </View>
            {item.price_drop_seen === false && (
              <TouchableOpacity
                style={styles.priceDropBadge}
                onPress={() => openPriceSheet(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.priceDropText}>↓ Price Drop</Text>
              </TouchableOpacity>
            )}
          </View>
          {item.price ? (
            <View style={styles.priceContainer}>
              <Text style={styles.priceText}>
                {item.currency ? `${item.currency} ` : ''}
                {item.price}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {collectionName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>📦</Text>
            </View>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + below to paste a URL, or use the browser extension.
            </Text>
          </View>
        }
      />

      <Modal
        visible={priceSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={dismissPriceDrop}
      >
        <Pressable style={styles.overlay} onPress={dismissPriceDrop}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Price History</Text>
            {priceSheetLoading ? (
              <ActivityIndicator
                size="small"
                color="#2563eb"
                style={styles.sheetLoader}
              />
            ) : priceHistory.length === 0 ? (
              <Text style={styles.sheetEmpty}>No price history recorded.</Text>
            ) : (
              <FlatList
                data={priceHistory}
                keyExtractor={(row) => row.id}
                style={styles.sheetList}
                renderItem={({ item: row }) => (
                  <View style={styles.historyRow}>
                    <Text style={styles.historyPrice}>
                      {row.currency ? `${row.currency} ` : ''}
                      {row.price ?? '—'}
                    </Text>
                    <Text style={styles.historyDate}>
                      {formatDate(row.checked_at)}
                    </Text>
                  </View>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={dismissPriceDrop}
              activeOpacity={0.9}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.9}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Item</Text>
            <TextInput
              style={styles.addInput}
              placeholder="https://example.com/product"
              placeholderTextColor="#737686"
              value={addUrl}
              onChangeText={setAddUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <View style={styles.addActions}>
              <TouchableOpacity
                style={styles.addCancelBtn}
                onPress={() => {
                  setShowAddModal(false);
                  setAddUrl('');
                }}
              >
                <Text style={styles.addCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addSaveBtn, (!addUrl.trim() || addSaving) && styles.addSaveBtnDisabled]}
                onPress={handleAddItem}
                disabled={!addUrl.trim() || addSaving}
                activeOpacity={0.9}
              >
                <Text style={styles.addSaveText}>
                  {addSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e7e8e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { fontSize: 22, color: '#191c1d', fontWeight: '600', marginTop: -2 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#191c1d',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 36 },

  list: { paddingHorizontal: PADDING, paddingBottom: 40, paddingTop: 8 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    backgroundColor: '#edeeef',
  },
  cardImagePlaceholder: { backgroundColor: '#e7e8e9' },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#191c1d',
    lineHeight: 20,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  favicon: { width: 14, height: 14, borderRadius: 3, marginRight: 5 },
  siteName: { fontSize: 12, color: '#434655', fontWeight: '500' },

  priceDropBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  priceDropText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },

  priceContainer: {
    marginLeft: 8,
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#191c1d',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    backgroundColor: '#f3f4f5',
    borderRadius: 16,
    marginTop: 24,
  },
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
  emptyIconText: { fontSize: 24 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191c1d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#434655',
    textAlign: 'center',
    lineHeight: 20,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: PADDING,
    paddingBottom: 36,
    maxHeight: Dimensions.get('window').height * 0.55,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#191c1d',
    marginBottom: 16,
  },
  sheetLoader: { marginVertical: 24 },
  sheetEmpty: {
    fontSize: 14,
    color: '#434655',
    textAlign: 'center',
    marginVertical: 24,
  },
  sheetList: { marginBottom: 16 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e7e8e9',
  },
  historyPrice: { fontSize: 15, fontWeight: '700', color: '#191c1d' },
  historyDate: { fontSize: 13, color: '#434655' },

  dismissButton: {
    backgroundColor: '#2563eb',
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dismissText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

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

  addInput: {
    backgroundColor: '#f3f4f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#191c1d',
    marginBottom: 16,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  addCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: '#e7e8e9',
  },
  addCancelText: { fontSize: 14, fontWeight: '600', color: '#434655' },
  addSaveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: '#2563eb',
  },
  addSaveBtnDisabled: { opacity: 0.5 },
  addSaveText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
