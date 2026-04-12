import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import 'widgets/collection_card.dart';
import 'widgets/new_collection_sheet.dart';

class CollectionsScreen extends StatefulWidget {
  const CollectionsScreen({super.key});

  /// Called from MainShell FAB.
  static void createNew(BuildContext context) {
    _CollectionsScreenState._createNewExternal(context);
  }

  @override
  State<CollectionsScreen> createState() => _CollectionsScreenState();
}

class _CollectionsScreenState extends State<CollectionsScreen> {
  static _CollectionsScreenState? _instance;

  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _collections = [];
  bool _loading = true;
  String _filter = 'all'; // 'all' | 'recent' | 'pinned'

  @override
  void initState() {
    super.initState();
    _instance = this;
    _load();
  }

  @override
  void dispose() {
    if (_instance == this) _instance = null;
    super.dispose();
  }

  static void _createNewExternal(BuildContext context) {
    if (_instance != null) {
      _instance!._showNewCollection();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final userId =
        context.read<AuthProvider>().userId;
    if (userId == null) return;

    var query = _supabase
        .from('collections')
        .select('*, items(count)')
        .eq('user_id', userId)
        .order('created_at', ascending: false);

    final data = await query;
    if (!mounted) return;

    List<Map<String, dynamic>> list = List<Map<String, dynamic>>.from(data);

    if (_filter == 'pinned') {
      final pinned = await _supabase
          .from('pinned_collections')
          .select('collection_id')
          .eq('user_id', userId);
      final ids = (pinned as List).map((p) => p['collection_id']).toSet();
      list = list.where((c) => ids.contains(c['id'])).toList();
    } else if (_filter == 'recent') {
      list.sort((a, b) {
        final aTime =
            DateTime.tryParse(a['updated_at'] ?? '') ?? DateTime(0);
        final bTime =
            DateTime.tryParse(b['updated_at'] ?? '') ?? DateTime(0);
        return bTime.compareTo(aTime);
      });
      list = list.take(10).toList();
    }

    // Fetch thumbnail images for each collection
    final collectionIds = list.map((c) => c['id']).toList();
    if (collectionIds.isNotEmpty) {
      final thumbs = await _supabase
          .from('items')
          .select('collection_id, image_url')
          .inFilter('collection_id', collectionIds)
          .not('image_url', 'is', null)
          .limit(4 * collectionIds.length);

      final thumbMap = <String, List<String>>{};
      for (final t in thumbs) {
        final cid = t['collection_id'] as String;
        final url = t['image_url'] as String?;
        if (url != null && url.isNotEmpty) {
          thumbMap.putIfAbsent(cid, () => []);
          if (thumbMap[cid]!.length < 4) thumbMap[cid]!.add(url);
        }
      }

      for (final c in list) {
        c['_thumbnails'] = thumbMap[c['id']] ?? [];
      }
    }

    setState(() {
      _collections = list;
      _loading = false;
    });
  }

  void _showNewCollection() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NewCollectionSheet(
        onCreated: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Collections'),
        actions: [
          IconButton(
            icon: const Icon(Icons.compare_arrows_rounded),
            tooltip: 'Compare',
            onPressed: () => context.push('/compare'),
          ),
          IconButton(
            icon: const Icon(Icons.feedback_outlined),
            tooltip: 'Feedback',
            onPressed: () => context.push('/feedback'),
          ),
        ],
      ),
      body: Column(
        children: [
          _FilterBar(
            selected: _filter,
            onChanged: (v) {
              setState(() => _filter = v);
              _load();
            },
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: AppTheme.primary))
                : _collections.isEmpty
                    ? _EmptyState(onAdd: _showNewCollection)
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.85,
                          ),
                          itemCount: _collections.length,
                          itemBuilder: (_, i) => CollectionCard(
                            collection: _collections[i],
                            onTap: () => context
                                .push('/collections/${_collections[i]['id']}'),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const _FilterBar({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final filters = [
      ('all', 'All'),
      ('recent', 'Recent'),
      ('pinned', 'Pinned'),
    ];
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        children: filters
            .map((f) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f.$2),
                    selected: selected == f.$1,
                    onSelected: (_) => onChanged(f.$1),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyState({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.grid_view_rounded,
              size: 56, color: AppTheme.textSecondary),
          const SizedBox(height: 16),
          Text('No collections yet',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Tap + to create your first collection',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: const Text('New Collection'),
          ),
        ],
      ),
    );
  }
}
