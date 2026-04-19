import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';
import 'widgets/add_item_sheet.dart';
import 'widgets/capture_item_sheet.dart';
import 'widgets/in_store_item_detail.dart';
import 'widgets/price_history_sheet.dart';
import 'widgets/similar_products_sheet.dart';
import 'widgets/nearby_stores_sheet.dart';
import 'widgets/edit_collection_sheet.dart';
import 'widgets/share_collection_sheet.dart';

class CollectionDetailScreen extends StatefulWidget {
  final String id;

  const CollectionDetailScreen({super.key, required this.id});

  @override
  State<CollectionDetailScreen> createState() =>
      _CollectionDetailScreenState();
}

class _CollectionDetailScreenState extends State<CollectionDetailScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _collection;
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      _supabase
          .from('collections')
          .select()
          .eq('id', widget.id)
          .single(),
      _supabase
          .from('items')
          .select('*, price_history(id, price, currency, checked_at)')
          .eq('collection_id', widget.id)
          .order('created_at', ascending: false),
    ]);
    if (!mounted) return;

    final collection = results[0] as Map<String, dynamic>;
    final rawItems = results[1] as List;
    final items = rawItems.map((i) {
      final m = Map<String, dynamic>.from(i);
      final hist = (m['price_history'] as List? ?? [])
        ..sort((a, b) => (b['checked_at'] as String)
            .compareTo(a['checked_at'] as String));
      m['price_history'] = hist;
      return m;
    }).toList();

    setState(() {
      _collection = collection;
      _items = items;
      _loading = false;
    });

    _retryStaleEnrichments(items);
  }

  void _retryStaleEnrichments(List<Map<String, dynamic>> items) {
    final now = DateTime.now();
    final pendingCutoff =
        now.subtract(const Duration(seconds: 30)).toIso8601String();
    final failedCutoff =
        now.subtract(const Duration(minutes: 5)).toIso8601String();
    // Completed items with no image get a retry at most once per hour — the
    // site may have been blocking us earlier, or enrichment ran before we
    // learned to follow redirect shorteners.
    final imagelessCutoff =
        now.subtract(const Duration(hours: 1)).toIso8601String();
    for (final item in items) {
      // In-store items are enriched once at capture time via
      // enrich-item-from-photos — skip the URL-enrichment retry path.
      if (item['source'] == 'in_store') continue;
      final status = item['enrichment_status'];
      final updatedAt =
          (item['updated_at'] ?? item['created_at']) as String;
      final hasImage = (item['cached_image_path'] as String?)?.isNotEmpty ==
              true ||
          (item['image_url'] as String?)?.isNotEmpty == true;
      final shouldRetry = (status == 'pending' &&
              (item['created_at'] as String).compareTo(pendingCutoff) < 0) ||
          (status == 'failed' &&
              updatedAt.compareTo(failedCutoff) < 0) ||
          (status == 'completed' &&
              !hasImage &&
              updatedAt.compareTo(imagelessCutoff) < 0);
      if (shouldRetry) {
        _invokeEnrich(item['id'] as String);
      }
    }
  }

  Future<void> _addItem(String url) async {
    final user = _supabase.auth.currentUser;
    if (user == null) return;

    final data = await _supabase
        .from('items')
        .insert({
          'url': url,
          'collection_id': widget.id,
          'user_id': user.id,
          'enrichment_status': 'pending',
        })
        .select()
        .single();

    setState(() => _items = [data, ..._items]);
    _invokeEnrich(data['id'] as String);
  }

  // supabase_flutter bakes the anon Authorization into the Functions client
  // at init and never swaps in the user's JWT — its AuthHttpClient uses
  // putIfAbsent, so it can't override. Pass the current session token
  // explicitly on every call so enrich-item sees an authenticated user.
  Future<FunctionResponse> _invokeEnrich(String itemId) {
    final token = _supabase.auth.currentSession?.accessToken;
    return _supabase.functions.invoke(
      'enrich-item',
      body: {'item_id': itemId},
      headers: token != null ? {'Authorization': 'Bearer $token'} : null,
    );
  }

  Future<void> _dismissPriceDrop(String itemId) async {
    await _supabase
        .from('items')
        .update({'price_drop_seen': true}).eq('id', itemId);
    setState(() {
      _items = _items
          .map((i) =>
              i['id'] == itemId ? {...i, 'price_drop_seen': true} : i)
          .toList();
    });
  }

  Future<void> _deleteItem(String itemId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete item?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppTheme.danger))),
        ],
      ),
    );
    if (confirmed != true) return;
    await _supabase.from('items').delete().eq('id', itemId);
    setState(() => _items.removeWhere((i) => i['id'] == itemId));
  }

  Future<void> _deleteCollection() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete collection?'),
        content: const Text(
            'This will delete the collection and all its items. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppTheme.danger))),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _supabase.from('collections').delete().eq('id', widget.id);
    if (mounted) Navigator.of(context).pop();
  }

  void _showAddItem() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.link, color: AppTheme.primary),
              title: const Text('Add from URL'),
              subtitle: const Text('Paste a product link'),
              onTap: () {
                Navigator.pop(ctx);
                _showAddFromUrl();
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined, color: AppTheme.primary),
              title: const Text('Capture in store'),
              subtitle: const Text('Snap photos — AI reads the details'),
              onTap: () {
                Navigator.pop(ctx);
                _showCapture();
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _showAddFromUrl() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddItemSheet(onAdd: _addItem),
    );
  }

  void _showCapture() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CaptureItemSheet(
        collectionId: widget.id,
        onSaved: (inserted) async {
          if (!mounted) return;
          setState(() => _items = [inserted, ..._items]);
        },
      ),
    );
  }

  void _showPriceHistory(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PriceHistorySheet(
        itemId: item['id'],
        itemTitle: item['title'] ?? item['url'],
        onDismissPriceDrop: () => _dismissPriceDrop(item['id']),
        hasPriceDrop: item['price_drop_seen'] == false,
      ),
    );
  }

  void _showSimilar(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SimilarProductsSheet(
        itemId: item['id'],
        itemTitle: item['title'] ?? 'this item',
      ),
    );
  }

  void _showNearby(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NearbyStoresSheet(item: item),
    );
  }

  void _showEditCollection() {
    if (_collection == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EditCollectionSheet(
        collection: _collection!,
        onUpdated: _load,
      ),
    );
  }

  void _showShareCollection() {
    if (_collection == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ShareCollectionSheet(
        collection: _collection!,
        onChanged: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_collection?['name'] ?? ''),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showAddItem,
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'share') _showShareCollection();
              if (v == 'edit') _showEditCollection();
              if (v == 'delete') _deleteCollection();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'share', child: Text('Share')),
              const PopupMenuItem(value: 'edit', child: Text('Edit')),
              const PopupMenuItem(
                  value: 'delete',
                  child: Text('Delete',
                      style: TextStyle(color: AppTheme.danger))),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : _items.isEmpty
              ? _emptyBody()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    itemCount: _items.length,
                    itemBuilder: (_, i) => _ItemCard(
                      item: _items[i],
                      onTap: () => _openItem(_items[i]),
                      onPriceHistory: () => _showPriceHistory(_items[i]),
                      onSimilar: () => _showSimilar(_items[i]),
                      onNearby: () => _showNearby(_items[i]),
                      onDelete: () => _deleteItem(_items[i]['id']),
                    ),
                  ),
                ),
    );
  }

  void _openItem(Map<String, dynamic> item) async {
    if (item['source'] == 'in_store') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => InStoreItemDetail(item: item)),
      );
      return;
    }
    final url = item['url'] as String?;
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    // Optimistic update + background re-enrich
    final now = DateTime.now().toIso8601String();
    setState(() => _items = _items.map((i) {
          return i['id'] == item['id'] ? {...i, 'last_viewed_at': now} : i;
        }).toList());
    _supabase
        .from('items')
        .update({'last_viewed_at': now}).eq('id', item['id']);
    _reEnrichAndRefresh(item['id'] as String);
  }

  Future<void> _reEnrichAndRefresh(String itemId) async {
    try {
      await _invokeEnrich(itemId);
    } catch (_) {
      return;
    }
    if (!mounted) return;
    final fresh = await _supabase
        .from('items')
        .select()
        .eq('id', itemId)
        .maybeSingle();
    if (fresh == null || !mounted) return;
    setState(() => _items = _items
        .map((i) => i['id'] == itemId ? {...i, ...fresh} : i)
        .toList());
  }

  Widget _emptyBody() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bookmark_border,
                size: 56, color: AppTheme.textSecondary),
            const SizedBox(height: 16),
            Text('No items yet',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('Add items by URL',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _showAddItem,
              icon: const Icon(Icons.add),
              label: const Text('Add Item'),
            ),
          ],
        ),
      );
}

// ──────────────────────────────────────────────────────────────────
// Item card widget
// ──────────────────────────────────────────────────────────────────

class _ItemCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;
  final VoidCallback onPriceHistory;
  final VoidCallback onSimilar;
  final VoidCallback onNearby;
  final VoidCallback onDelete;

  const _ItemCard({
    required this.item,
    required this.onTap,
    required this.onPriceHistory,
    required this.onSimilar,
    required this.onNearby,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isInStore = item['source'] == 'in_store';
    String? imageUri =
        (item['cached_image_path'] ?? item['image_url']) as String?;
    if (imageUri == null && isInStore) {
      final photos = item['photo_urls'];
      if (photos is List && photos.isNotEmpty) {
        imageUri = photos.first?.toString();
      }
    }
    final hist = isInStore
        ? const <Map<String, dynamic>>[]
        : List<Map<String, dynamic>>.from(item['price_history'] ?? []);
    final histSlice = hist.take(3).toList();
    final hasPriceDrop = !isInStore && item['price_drop_seen'] == false;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            if (imageUri != null)
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(12)),
                child: CachedNetworkImage(
                  imageUrl: imageUri,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => const _ImagePlaceholder(),
                ),
              )
            else
              const ClipRRect(
                borderRadius:
                    BorderRadius.vertical(top: Radius.circular(12)),
                child: _ImagePlaceholder(),
              ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    item['title'] ?? item['url'] ?? '',
                    style: Theme.of(context).textTheme.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),

                  // Site / store row
                  if (isInStore)
                    Row(
                      children: [
                        const Icon(Icons.storefront_outlined,
                            size: 14, color: AppTheme.textSecondary),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            [
                              item['store_name']?.toString(),
                              _formatCapturedAt(item['captured_at']),
                            ].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                            style: Theme.of(context).textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    )
                  else
                    Row(
                      children: [
                        if (item['site_favicon_url'] != null)
                          CachedNetworkImage(
                            imageUrl: item['site_favicon_url'],
                            width: 14,
                            height: 14,
                            errorWidget: (_, __, ___) =>
                                const SizedBox.shrink(),
                          ),
                        if (item['site_favicon_url'] != null)
                          const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            item['site_name'] ??
                                Uri.tryParse(item['url'] ?? '')
                                    ?.host ??
                                '',
                            style: Theme.of(context).textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),

                  // Price
                  if (item['price'] != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text(
                          '${item['currency'] != null ? '${item['currency']} ' : ''}${item['price']}',
                          style: const TextStyle(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        if (item['lowest_price'] != null &&
                            item['lowest_price'] != item['price']) ...[
                          const SizedBox(width: 8),
                          Text(
                            'Low: ${item['currency'] != null ? '${item['currency']} ' : ''}${item['lowest_price']}',
                            style: const TextStyle(
                              color: AppTheme.success,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],

                  // Price drop badge
                  if (hasPriceDrop) ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: onPriceHistory,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.arrow_downward,
                                size: 12, color: AppTheme.success),
                            SizedBox(width: 4),
                            Text('Price Drop',
                                style: TextStyle(
                                    color: AppTheme.success,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                  ],

                  // Mini price history
                  if (histSlice.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text('Price History',
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    ...histSlice.map((row) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${row['currency'] != null ? '${row['currency']} ' : ''}${row['price'] ?? '—'}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              Text(
                                _formatDate(row['checked_at']),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        )),
                    if (hist.length > 3)
                      GestureDetector(
                        onTap: onPriceHistory,
                        child: Text(
                          '+${hist.length - 3} more',
                          style: const TextStyle(
                              color: AppTheme.primary, fontSize: 12),
                        ),
                      ),
                  ],

                  // Actions row
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (!isInStore) ...[
                        _ActionChip(
                          icon: Icons.compare_arrows,
                          label: 'Similar',
                          onTap: onSimilar,
                        ),
                        const SizedBox(width: 8),
                        _ActionChip(
                          icon: Icons.location_on_outlined,
                          label: 'Nearby',
                          onTap: onNearby,
                        ),
                      ] else
                        _ActionChip(
                          icon: Icons.photo_library_outlined,
                          label:
                              '${(item['photo_urls'] as List?)?.length ?? 0} photo${((item['photo_urls'] as List?)?.length ?? 0) == 1 ? '' : 's'}',
                          onTap: onTap,
                        ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.delete_outline,
                            size: 18, color: AppTheme.danger),
                        onPressed: onDelete,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        splashRadius: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    return '${_months[d.month - 1]} ${d.day}, ${d.year}';
  }

  static String? _formatCapturedAt(dynamic iso) {
    if (iso == null) return null;
    final d = DateTime.tryParse(iso.toString())?.toLocal();
    if (d == null) return null;
    return '${_months[d.month - 1]} ${d.day}';
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionChip(
      {required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppTheme.placeholder,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: AppTheme.textSecondary),
            const SizedBox(width: 4),
            Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();

  @override
  Widget build(BuildContext context) => Container(
        height: 180,
        width: double.infinity,
        color: AppTheme.placeholder,
        child: const Icon(Icons.image_outlined,
            size: 40, color: AppTheme.textSecondary),
      );
}
