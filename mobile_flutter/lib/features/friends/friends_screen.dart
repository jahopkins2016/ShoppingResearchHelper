import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/share_helpers.dart';

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _friends = [];
  bool _loading = true;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) {
      setState(() {
        _friends = [];
        _loading = false;
      });
      return;
    }
    try {
      final data = await _supabase
          .from('friends')
          .select('*, profiles!friends_friend_id_fkey(id, display_name, avatar_url, email)')
          .eq('user_id', userId)
          .order('created_at', ascending: false);
      if (!mounted) return;
      setState(() {
        _friends = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('Error loading friends: $e\n$st');
      if (!mounted) return;
      setState(() {
        _friends = [];
        _loading = false;
      });
    }
  }

  Future<void> _syncFriends() async {
    setState(() => _syncing = true);
    final userId = context.read<AuthProvider>().userId;
    final email = _supabase.auth.currentUser?.email ?? '';

    final uniqueIds = <String>{};

    try {
      // Direction 1: collections shared WITH me (accepted) → get the sharer's profile id
      final sharedWithMe = await _supabase
          .from('collection_shares')
          .select('shared_by')
          .eq('shared_with_email', email)
          .eq('status', 'accepted');

      for (final row in sharedWithMe as List) {
        final id = row['shared_by'] as String?;
        if (id != null && id != userId) uniqueIds.add(id);
      }

      // Direction 2: collections I shared with others (accepted) → look up their user id by email
      final sharedByMe = await _supabase
          .from('collection_shares')
          .select('shared_with_email')
          .eq('shared_by', userId!)
          .eq('status', 'accepted');

      final emailsToResolve = (sharedByMe as List)
          .map((r) => r['shared_with_email'] as String?)
          .where((e) => e != null && e.isNotEmpty)
          .cast<String>()
          .toList();

      if (emailsToResolve.isNotEmpty) {
        final profiles = await _supabase
            .from('profiles')
            .select('id')
            .inFilter('email', emailsToResolve);
        for (final p in profiles as List) {
          final id = p['id'] as String?;
          if (id != null && id != userId) uniqueIds.add(id);
        }
      }

      for (final friendId in uniqueIds) {
        await _supabase.from('friends').upsert(
          {'user_id': userId, 'friend_id': friendId, 'source': 'share'},
          onConflict: 'user_id,friend_id',
          ignoreDuplicates: true,
        );
      }
    } catch (e, st) {
      debugPrint('Error syncing friends: $e\n$st');
    }

    await _load();
    if (mounted) setState(() => _syncing = false);
  }

  Future<void> _removeFriend(String friendUserId) async {
    final userId = context.read<AuthProvider>().userId;
    await _supabase
        .from('friends')
        .delete()
        .eq('user_id', userId!)
        .eq('friend_id', friendUserId);
    _load();
  }

  Future<void> _inviteFriend() async {
    // Referral code lives on the profiles row, not auth user metadata.
    String? code;
    final userId = context.read<AuthProvider>().userId;
    if (userId != null) {
      try {
        final row = await _supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', userId)
            .single();
        code = row['referral_code'] as String?;
      } catch (e) {
        debugPrint('Failed to load referral_code: $e');
      }
    }
    if (!mounted) return;
    await shareReferralLink(context, referralCode: code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Friends'),
        actions: [
          if (_syncing)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      color: AppTheme.primary, strokeWidth: 2)),
            )
          else
            IconButton(
              icon: const Icon(Icons.sync),
              tooltip: 'Sync from shared collections',
              onPressed: _syncFriends,
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _inviteFriend,
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_outlined),
        label: const Text('Invite Friend'),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : (context.read<AuthProvider>().userId == null
              ? Center(
                  child: Text('You must be logged in to see friends.',
                      style: Theme.of(context).textTheme.bodyMedium),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _friends.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.people_outline,
                                  size: 56, color: AppTheme.textSecondary),
                              const SizedBox(height: 16),
                              Text('No friends yet',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 8),
                              Text(
                                  'Invite friends or tap sync to add people\nfrom your shared collections',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 24),
                              ElevatedButton.icon(
                                onPressed: _syncFriends,
                                icon: const Icon(Icons.sync),
                                label: const Text('Sync Friends'),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                          itemCount: _friends.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 4),
                          itemBuilder: (_, i) {
                            final row = _friends[i];
                            final profile = row['profiles']
                                as Map<String, dynamic>?;
                            final name = profile?['display_name'] ??
                                profile?['email'] ??
                                'Unknown';
                            // "Just joined" badge for friendships younger
                            // than 48h — makes new invite-acceptances
                            // easy to spot at the top of the list.
                            final createdAt =
                                DateTime.tryParse(row['created_at'] as String? ?? '')
                                    ?.toLocal();
                            final isNew = createdAt != null &&
                                DateTime.now().difference(createdAt) <
                                    const Duration(hours: 48);
                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 0, vertical: 4),
                              leading: _Avatar(name: name),
                              title: Row(children: [
                                Flexible(
                                  child: Text(name,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall),
                                ),
                                if (isNew) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.primary
                                          .withValues(alpha: 0.12),
                                      borderRadius:
                                          BorderRadius.circular(999),
                                    ),
                                    child: const Text(
                                      'Just joined',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.primary,
                                      ),
                                    ),
                                  ),
                                ],
                              ]),
                              subtitle:
                                  Text(profile?['email'] ?? ''),
                              trailing: IconButton(
                                icon: const Icon(
                                    Icons.person_remove_outlined,
                                    color: AppTheme.danger),
                                onPressed: () => _removeFriend(
                                    profile?['id'] ?? ''),
                              ),
                            );
                          },
                        ),
                )),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  const _Avatar({required this.name});

  @override
  Widget build(BuildContext context) {
    final letter = name.isEmpty ? '?' : name[0].toUpperCase();
    return CircleAvatar(
      radius: 22,
      backgroundColor: AppTheme.primaryLight,
      child: Text(letter,
          style: const TextStyle(
              color: AppTheme.primary, fontWeight: FontWeight.w700)),
    );
  }
}
