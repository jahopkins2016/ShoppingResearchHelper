import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class CompareDetailScreen extends StatefulWidget {
  final String id;
  const CompareDetailScreen({super.key, required this.id});

  @override
  State<CompareDetailScreen> createState() =>
      _CompareDetailScreenState();
}

class _CompareDetailScreenState extends State<CompareDetailScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _comparison;
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
          .from('item_comparisons')
          .select()
          .eq('id', widget.id)
          .single(),
      _supabase
          .from('comparison_items')
          .select('*, items(id, title, url, image_url, cached_image_path, price, currency, brand, rating, site_name)')
          .eq('comparison_id', widget.id)
          .order('sort_order', ascending: true),
    ]);
    if (!mounted) return;
    setState(() {
      _comparison = results[0] as Map<String, dynamic>;
      _items = (results[1] as List).cast<Map<String, dynamic>>();
      _loading = false;
    });
  }

  Future<void> _addItem() async {
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;

    // Pick from user's saved items
    final allItems = await _supabase
        .from('items')
        .select('id, title, url, price, image_url')
        .eq('user_id', userId)
        .order('created_at', ascending: false);

    final existing =
        _items.map((ci) => (ci['items'] as Map?)?['id']).toSet();
    final available = (allItems as List)
        .where((i) => !existing.contains((i as Map)['id']))
        .toList();

    if (!mounted) return;

    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ItemPickerSheet(items: available),
    );

    if (picked == null) return;

    await _supabase.from('comparison_items').insert({
      'comparison_id': widget.id,
      'item_id': picked['id'],
      'sort_order': _items.length,
    });
    _load();
  }

  Future<void> _removeItem(String comparisonItemId) async {
    await _supabase
        .from('comparison_items')
        .delete()
        .eq('id', comparisonItemId);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_comparison?['name'] ?? 'Compare'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _addItem,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : _items.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.compare_arrows_rounded,
                          size: 56, color: AppTheme.textSecondary),
                      const SizedBox(height: 16),
                      Text('No items in this comparison',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text('Add items from your saved products',
                          style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _addItem,
                        icon: const Icon(Icons.add),
                        label: const Text('Add Item'),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: _items.map((ci) {
                      final item =
                          ci['items'] as Map<String, dynamic>? ?? {};
                      return _CompareCard(
                        comparisonItemId: ci['id'] as String,
                        item: item,
                        onRemove: () => _removeItem(ci['id'] as String),
                      );
                    }).toList(),
                  ),
                ),
    );
  }
}

class _CompareCard extends StatelessWidget {
  final String comparisonItemId;
  final Map<String, dynamic> item;
  final VoidCallback onRemove;

  const _CompareCard({
    required this.comparisonItemId,
    required this.item,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final imageUri =
        (item['cached_image_path'] ?? item['image_url']) as String?;

    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image + remove button
          Stack(
            children: [
              if (imageUri != null)
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(12)),
                  child: CachedNetworkImage(
                    imageUrl: imageUri,
                    height: 140,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _placeholder(),
                  ),
                )
              else
                _placeholder(),
              Positioned(
                top: 6,
                right: 6,
                child: GestureDetector(
                  onTap: onRemove,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close,
                        size: 16, color: AppTheme.danger),
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['title'] ?? item['url'] ?? '',
                  style: Theme.of(context).textTheme.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item['price'] != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${item['currency'] != null ? '${item['currency']} ' : ''}${item['price']}',
                    style: const TextStyle(
                        color: AppTheme.primary,
                        fontWeight: FontWeight.w700),
                  ),
                ],
                if (item['brand'] != null) ...[
                  const SizedBox(height: 4),
                  Text('Brand: ${item['brand']}',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
                if (item['rating'] != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.star,
                          size: 12, color: AppTheme.warning),
                      const SizedBox(width: 2),
                      Text('${item['rating']}',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () async {
                    final url = item['url'] as String?;
                    if (url == null) return;
                    final uri = Uri.tryParse(url);
                    if (uri != null && await canLaunchUrl(uri)) {
                      await launchUrl(uri,
                          mode: LaunchMode.externalApplication);
                    }
                  },
                  child: const Text(
                    'View product →',
                    style: TextStyle(
                        color: AppTheme.primary, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _placeholder() => Container(
        height: 140,
        width: double.infinity,
        decoration: const BoxDecoration(
          color: AppTheme.placeholder,
          borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
        ),
        child: const Center(
          child: Icon(Icons.image_outlined,
              size: 32, color: AppTheme.textSecondary),
        ),
      );
}

class _ItemPickerSheet extends StatelessWidget {
  final List items;
  const _ItemPickerSheet({required this.items});

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: AppTheme.divider,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
              child: Text('Pick an item',
                  style: Theme.of(context).textTheme.titleMedium),
            ),
            const Divider(),
            Expanded(
              child: items.isEmpty
                  ? const Center(child: Text('No items available'))
                  : ListView.separated(
                      controller: controller,
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final item =
                            items[i] as Map<String, dynamic>;
                        return ListTile(
                          title: Text(
                            item['title'] ?? item['url'] ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle:
                              item['price'] != null ? Text(item['price']) : null,
                          onTap: () => Navigator.of(context).pop(item),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}


