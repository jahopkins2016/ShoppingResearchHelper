import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../collections/collection_detail_screen.dart';
import 'widgets/pending_invitations.dart';

class SharedScreen extends StatefulWidget {
  const SharedScreen({super.key});

  @override
  State<SharedScreen> createState() => _SharedScreenState();
}

class _SharedScreenState extends State<SharedScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _shared = [];
  List<Map<String, dynamic>> _pending = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;

    final results = await Future.wait([
      // Collections shared with user (accepted)
      _supabase
          .from('collection_shares')
          .select('*, collections(*, profiles!collections_user_id_fkey(display_name, avatar_url, email))')
          .eq('shared_with_email',
              _supabase.auth.currentUser?.email ?? '')
          .eq('status', 'accepted'),
      // Pending invitations
      _supabase
          .from('collection_shares')
          .select('*, collections(name), profiles!collection_shares_shared_by_fkey(display_name, avatar_url, email)')
          .eq('shared_with_email',
              _supabase.auth.currentUser?.email ?? '')
          .eq('status', 'pending'),
    ]);

    if (!mounted) return;
    setState(() {
      _shared = List<Map<String, dynamic>>.from(results[0]);
      _pending = List<Map<String, dynamic>>.from(results[1]);
      _loading = false;
    });
  }

  Future<void> _respond(String shareId, String status) async {
    await _supabase
        .from('collection_shares')
        .update({'status': status}).eq('id', shareId);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shared with Me')),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_pending.isNotEmpty) ...[
                    PendingInvitations(
                        invitations: _pending, onRespond: _respond),
                    const SizedBox(height: 16),
                  ],
                  if (_shared.isEmpty && _pending.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 60),
                        child: Column(
                          children: [
                            const Icon(Icons.folder_shared_outlined,
                                size: 56, color: AppTheme.textSecondary),
                            const SizedBox(height: 16),
                            Text('No shared collections',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium),
                            const SizedBox(height: 8),
                            Text(
                                "Collections others share with you\nwill appear here",
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
                      ),
                    ),
                  ..._shared.map((share) {
                    final col = share['collections'] as Map<String, dynamic>?;
                    final owner =
                        col?['profiles'] as Map<String, dynamic>?;
                    final role = share['role'] as String? ?? 'viewer';
                    return _SharedCard(
                      collection: col ?? {},
                      ownerName: owner?['display_name'] ??
                          owner?['email'] ??
                          'Someone',
                      role: role,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CollectionDetailScreen(
                              id: col?['id'] ?? ''),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}

class _SharedCard extends StatelessWidget {
  final Map<String, dynamic> collection;
  final String ownerName;
  final String role;
  final VoidCallback onTap;

  const _SharedCard({
    required this.collection,
    required this.ownerName,
    required this.role,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.folder_shared_outlined,
                    color: AppTheme.primary, size: 26),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(collection['name'] ?? 'Untitled',
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 2),
                    Text('Shared by $ownerName',
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: role == 'editor'
                      ? const Color(0xFFEFF6FF)
                      : AppTheme.placeholder,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  role == 'editor' ? 'Editor' : 'Viewer',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: role == 'editor'
                        ? AppTheme.primary
                        : AppTheme.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
