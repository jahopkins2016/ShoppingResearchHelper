import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _conversations = [];
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

    final data = await _supabase
        .from('conversation_participants')
        .select('conversation_id, conversations(id, last_message, updated_at, conversation_participants(user_id, profiles(id, display_name, avatar_url, email)))')
        .eq('user_id', userId)
        .order('conversation_id');

    if (!mounted) return;

    final convs = <Map<String, dynamic>>[];
    for (final row in data as List) {
      final conv =
          row['conversations'] as Map<String, dynamic>? ?? {};
      final participants =
          conv['conversation_participants'] as List? ?? [];
      final other = participants.firstWhere(
        (p) => (p as Map)['user_id'] != userId,
        orElse: () => null,
      );
      convs.add({...conv, 'other_profile': (other as Map?)?['profiles']});
    }
    convs.sort((a, b) =>
        (b['updated_at'] as String? ?? '')
            .compareTo(a['updated_at'] as String? ?? ''));

    setState(() {
      _conversations = convs;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              onRefresh: _load,
              child: _conversations.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.chat_bubble_outline,
                              size: 56, color: AppTheme.textSecondary),
                          const SizedBox(height: 16),
                          Text('No conversations',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium),
                          const SizedBox(height: 8),
                          Text(
                              'Message friends from the Friends tab',
                              style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _conversations.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final conv = _conversations[i];
                        final profile =
                            conv['other_profile'] as Map<String, dynamic>?;
                        final name = profile?['display_name'] ??
                            profile?['email'] ??
                            'Unknown';
                        final lastMsg =
                            conv['last_message'] as String? ?? '';
                        final updAt = DateTime.tryParse(
                            conv['updated_at'] as String? ?? '');

                        return ListTile(
                          contentPadding:
                              EdgeInsets.zero,
                          leading: CircleAvatar(
                            backgroundColor: AppTheme.primaryLight,
                            child: Text(
                              name.isEmpty ? '?' : name[0].toUpperCase(),
                              style: const TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                          title: Text(name,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall),
                          subtitle: Text(
                            lastMsg.isEmpty ? 'Start a conversation' : lastMsg,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          trailing: updAt != null
                              ? Text(
                                  timeago.format(updAt),
                                  style: Theme.of(context).textTheme.bodySmall,
                                )
                              : null,
                          onTap: () =>
                              context.push('/messages/${conv['id']}'),
                        );
                      },
                    ),
            ),
    );
  }
}
