import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../shared/widgets/pending_invitations.dart';
import 'widgets/collection_card.dart';
import 'widgets/new_collection_sheet.dart';
import 'widgets/share_collection_sheet.dart';

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
  List<Map<String, dynamic>> _pendingInvites = [];
  bool _loading = true;
  String _filter = 'all';
  bool _showArchived = false;

  String? _lastUserId;

  @override
  void initState() {
    super.initState();
    _instance = this;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reload whenever the authenticated user changes (including initial login).
    final userId = context.watch<AuthProvider>().userId;
    if (userId != _lastUserId) {
      _lastUserId = userId;
      if (userId != null) {
        _load();
      } else {
        setState(() {
          _collections = [];
          _pendingInvites = [];
          _loading = false;
        });
      }
    }
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
    try {
      await _loadInner();
    } catch (e, st) {
      debugPrint('Error loading collections: $e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not load collections: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadInner() async {
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;
    final email = _supabase.auth.currentUser?.email ?? '';

    final results = await Future.wait([
      _supabase
          .from('collections')
          .select('*, items(count)')
          .eq('user_id', userId)
          .order('created_at', ascending: false),
      _supabase
          .from('collection_shares')
          .select(
              'id, role, collections(*, items(count), profiles!collections_user_id_fkey(display_name, avatar_url, email))')
          .eq('shared_with_email', email)
          .eq('status', 'accepted'),
      _supabase
          .from('collection_shares')
          .select(
              'id, role, collections(name), profiles!collection_shares_shared_by_fkey(display_name, avatar_url, email)')
          .eq('shared_with_email', email)
          .eq('status', 'pending'),
      _supabase
          .from('collection_shares')
          .select('collection_id')
          .eq('shared_by', userId),
    ]);

    if (!mounted) return;

    final owned = List<Map<String, dynamic>>.from(results[0]);
    final acceptedShares = List<Map<String, dynamic>>.from(results[1]);
    final pending = List<Map<String, dynamic>>.from(results[2]);
    final sharedByMeRows = List<Map<String, dynamic>>.from(results[3]);

    // Count how many recipients each of my collections has been shared with.
    final sharedByMeCounts = <String, int>{};
    for (final row in sharedByMeRows) {
      final cid = row['collection_id'] as String?;
      if (cid == null) continue;
      sharedByMeCounts[cid] = (sharedByMeCounts[cid] ?? 0) + 1;
    }

    // Tag owned collections with ownership + share count.
    for (final c in owned) {
      c['_ownership'] = 'mine';
      c['_sharedCount'] = sharedByMeCounts[c['id']] ?? 0;
    }

    // Unwrap accepted-share rows into collection objects with owner metadata.
    final sharedWithMe = <Map<String, dynamic>>[];
    for (final share in acceptedShares) {
      final col = share['collections'] as Map<String, dynamic>?;
      if (col == null) continue;
      final ownerProfile = col['profiles'] as Map<String, dynamic>?;
      final normalized = Map<String, dynamic>.from(col);
      normalized['_ownership'] = 'shared_with_me';
      normalized['_sharedCount'] = 0;
      normalized['_shareRole'] = share['role'];
      normalized['_ownerName'] = ownerProfile?['display_name'] ??
          ownerProfile?['email'] ??
          'Someone';
      normalized['_ownerAvatar'] = ownerProfile?['avatar_url'];
      sharedWithMe.add(normalized);
    }

    var list = [...owned, ...sharedWithMe];

    // Archive filter: hide archived by default; show only archived when toggled.
    if (_showArchived) {
      list = list.where((c) => c['archived_at'] != null).toList();
    } else {
      list = list.where((c) => c['archived_at'] == null).toList();
    }

    // Filter pass.
    switch (_filter) {
      case 'mine':
        list = list.where((c) => c['_ownership'] == 'mine').toList();
        break;
      case 'shared_with_me':
        list =
            list.where((c) => c['_ownership'] == 'shared_with_me').toList();
        break;
      case 'shared_by_me':
        list = list
            .where((c) =>
                c['_ownership'] == 'mine' && (c['_sharedCount'] as int) > 0)
            .toList();
        break;
      case 'public':
        list = list.where((c) => c['is_public'] == true).toList();
        break;
      case 'pinned':
        final pinned = await _supabase
            .from('pinned_collections')
            .select('collection_id')
            .eq('user_id', userId);
        final ids =
            (pinned as List).map((p) => p['collection_id']).toSet();
        list = list.where((c) => ids.contains(c['id'])).toList();
        break;
      case 'recent':
        list.sort((a, b) {
          final aTime =
              DateTime.tryParse(a['updated_at'] ?? '') ?? DateTime(0);
          final bTime =
              DateTime.tryParse(b['updated_at'] ?? '') ?? DateTime(0);
          return bTime.compareTo(aTime);
        });
        list = list.take(10).toList();
        break;
      case 'all':
      default:
        break;
    }

    // Fetch thumbnail images for each visible collection.
    final collectionIds =
        list.map((c) => c['id']).whereType<String>().toList();
    if (collectionIds.isNotEmpty) {
      // Fetch items with images first, then fill gaps with favicon fallbacks.
      final thumbs = await _supabase
          .from('items')
          .select('collection_id, image_url, url')
          .inFilter('collection_id', collectionIds)
          .limit(8 * collectionIds.length);

      final thumbMap = <String, List<String>>{};
      for (final t in thumbs) {
        final cid = t['collection_id'] as String;
        thumbMap.putIfAbsent(cid, () => []);
        if (thumbMap[cid]!.length >= 4) continue;

        final url = t['image_url'] as String?;
        if (url != null && url.isNotEmpty) {
          thumbMap[cid]!.add(url);
        } else {
          // Favicon fallback for items without a product image
          final sourceUrl = t['url'] as String?;
          if (sourceUrl != null) {
            final uri = Uri.tryParse(sourceUrl);
            if (uri != null && uri.host.isNotEmpty) {
              thumbMap[cid]!.add(
                  'https://www.google.com/s2/favicons?domain=${uri.host}&sz=128');
            }
          }
        }
      }
      for (final c in list) {
        c['_thumbnails'] = thumbMap[c['id']] ?? [];
      }
    }

    setState(() {
      _collections = list;
      _pendingInvites = pending;
    });
  }

  Future<void> _respondToInvite(String shareId, String status) async {
    await _supabase
        .from('collection_shares')
        .update({'status': status}).eq('id', shareId);
    _load();
  }

  void _showShareSheet(Map<String, dynamic> collection) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ShareCollectionSheet(
        collection: collection,
        onChanged: _load,
      ),
    );
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
      appBar: AppBar(
        title: const Text('Collections'),
        actions: [
          IconButton(
            icon: const Icon(Icons.compare_arrows_rounded),
            tooltip: 'Compare',
            onPressed: () => context.push('/compare'),
          ),
          IconButton(
            icon: Icon(_showArchived
                ? Icons.unarchive_outlined
                : Icons.archive_outlined),
            tooltip: _showArchived ? 'Hide archived' : 'Show archived',
            onPressed: () {
              setState(() => _showArchived = !_showArchived);
              _load();
            },
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
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _buildBody(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_pendingInvites.isEmpty && _collections.isEmpty) {
      return ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: _EmptyState(
              showArchived: _showArchived,
              onAdd: _showNewCollection,
            ),
          ),
        ],
      );
    }

    return CustomScrollView(
      slivers: [
        if (_pendingInvites.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: PendingInvitations(
                invitations: _pendingInvites,
                onRespond: _respondToInvite,
              ),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
          sliver: SliverGrid(
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.85,
            ),
            delegate: SliverChildBuilderDelegate(
              (_, i) => CollectionCard(
                collection: _collections[i],
                onTap: () async {
                  await context
                      .push('/collections/${_collections[i]['id']}');
                  if (mounted) _load();
                },
                onShare: () => _showShareSheet(_collections[i]),
              ),
              childCount: _collections.length,
            ),
          ),
        ),
      ],
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
      ('mine', 'Mine'),
      ('shared_with_me', 'Shared with me'),
      ('shared_by_me', 'Shared by me'),
      ('public', 'Public'),
      ('pinned', 'Pinned'),
      ('recent', 'Recent'),
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
  final bool showArchived;
  const _EmptyState({required this.onAdd, required this.showArchived});

  @override
  Widget build(BuildContext context) {
    if (showArchived) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.archive_outlined,
                size: 56, color: AppTheme.textSecondary),
            const SizedBox(height: 16),
            Text('No archived collections',
                style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      );
    }
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
