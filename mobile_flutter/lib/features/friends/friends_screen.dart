import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

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
    if (userId == null) return;

    final data = await _supabase
        .from('friends')
        .select('*, profiles!friends_friend_user_id_fkey(id, display_name, avatar_url, email)')
        .eq('user_id', userId);
    if (!mounted) return;
    setState(() {
      _friends = List<Map<String, dynamic>>.from(data);
      _loading = false;
    });
  }

  Future<void> _syncFriends() async {
    setState(() => _syncing = true);
    final userId = context.read<AuthProvider>().userId;
    final email = _supabase.auth.currentUser?.email ?? '';

    // Bidirectional: find all users from collection_shares where I shared
    // or was shared with
    final sharesData = await _supabase
        .from('collection_shares')
        .select('shared_by, profiles!collection_shares_shared_by_fkey(id)')
        .eq('shared_with_email', email)
        .eq('status', 'accepted');

    final uniqueIds = (sharesData as List)
        .map((s) =>
            (s['profiles'] as Map<String, dynamic>?)?['id'] as String?)
        .where((id) => id != null && id != userId)
        .toSet();

    for (final friendId in uniqueIds) {
      if (friendId == null) continue;
      await _supabase.from('friends').upsert(
        {'user_id': userId, 'friend_user_id': friendId},
        onConflict: 'user_id,friend_user_id',
        ignoreDuplicates: true,
      );
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
        .eq('friend_user_id', friendUserId);
    _load();
  }

  Future<void> _message(Map<String, dynamic> profile) async {
    final userId = context.read<AuthProvider>().userId;
    final friendId = profile['id'] as String?;
    if (friendId == null || userId == null) return;

    // Find existing conversation
    final participants = await _supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

    final myConvIds =
        (participants as List).map((p) => p['conversation_id']).toSet();

    final friendParts = await _supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', friendId);

    final friendConvIds =
        (friendParts as List).map((p) => p['conversation_id']).toSet();

    final shared =
        myConvIds.intersection(friendConvIds).firstOrNull;

    if (shared != null) {
      if (mounted) context.push('/messages/$shared');
      return;
    }

    // Create new conversation
    final conv = await _supabase
        .from('conversations')
        .insert({'last_message': null})
        .select()
        .single();

    await _supabase.from('conversation_participants').insert([
      {'conversation_id': conv['id'], 'user_id': userId},
      {'conversation_id': conv['id'], 'user_id': friendId},
    ]);

    if (mounted) context.push('/messages/${conv['id']}');
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
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
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
                              'Tap sync to add friends from\nyour shared collections',
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
                      padding: const EdgeInsets.all(16),
                      itemCount: _friends.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: 4),
                      itemBuilder: (_, i) {
                        final profile = _friends[i]['profiles']
                            as Map<String, dynamic>?;
                        final name = profile?['display_name'] ??
                            profile?['email'] ??
                            'Unknown';
                        return ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 0, vertical: 4),
                          leading: _Avatar(name: name),
                          title: Text(name,
                              style:
                                  Theme.of(context).textTheme.titleSmall),
                          subtitle:
                              Text(profile?['email'] ?? ''),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(
                                    Icons.chat_bubble_outline,
                                    color: AppTheme.primary),
                                onPressed: () =>
                                    _message(profile ?? {}),
                              ),
                              IconButton(
                                icon: const Icon(
                                    Icons.person_remove_outlined,
                                    color: AppTheme.danger),
                                onPressed: () => _removeFriend(
                                    profile?['id'] ?? ''),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
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
