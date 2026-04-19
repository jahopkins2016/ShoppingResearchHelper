import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class ConversationScreen extends StatefulWidget {
  final String id;
  const ConversationScreen({super.key, required this.id});

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _supabase = Supabase.instance.client;
  final _messageCtrl = TextEditingController();
  final _scrollController = ScrollController();

  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _otherProfile;
  bool _loading = true;
  bool _sending = false;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _messageCtrl.dispose();
    _scrollController.dispose();
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<void> _load() async {
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;

    // Load messages
    final msgs = await _supabase
        .from('messages')
        .select()
        .eq('conversation_id', widget.id)
        .order('created_at', ascending: true);

    // Load other participant's profile
    final parts = await _supabase
        .from('conversation_participants')
        .select('user_id, profiles(id, display_name, avatar_url, email)')
        .eq('conversation_id', widget.id)
        .neq('user_id', userId);

    if (!mounted) return;

    final otherPart =
        (parts as List).firstOrNull as Map<String, dynamic>?;

    setState(() {
      _messages = List<Map<String, dynamic>>.from(msgs);
      _otherProfile =
          otherPart?['profiles'] as Map<String, dynamic>?;
      _loading = false;
    });

    _markAsRead(userId);
    _scrollToBottom();
    _subscribeRealtime(userId);
  }

  void _subscribeRealtime(String userId) {
    _channel = _supabase
        .channel('conversation_${widget.id}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: widget.id,
          ),
          callback: (payload) {
            final newMsg = payload.newRecord;
            setState(() => _messages.add(newMsg));
            _scrollToBottom();
            if (newMsg['sender_id'] != userId) {
              _supabase
                  .from('messages')
                  .update({'read_at': DateTime.now().toIso8601String()}).eq('id', newMsg['id'] as String);
            }
          },
        )
        .subscribe();
  }

  void _markAsRead(String userId) {
    _supabase
        .from('messages')
        .update({'read_at': DateTime.now().toIso8601String()})
        .eq('conversation_id', widget.id)
        .neq('sender_id', userId);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _messageCtrl.text.trim();
    if (text.isEmpty) return;
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;

    setState(() => _sending = true);
    _messageCtrl.clear();
    try {
      await _supabase.from('messages').insert({
        'conversation_id': widget.id,
        'sender_id': userId,
        'body': text,
      });
      await _supabase.from('conversations').update({
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', widget.id);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = context.read<AuthProvider>().userId;
    final name = _otherProfile?['display_name'] ??
        _otherProfile?['email'] ??
        'Chat';

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: AppTheme.primaryLight,
              child: Text(
                name.isEmpty ? '?' : name[0].toUpperCase(),
                style: const TextStyle(
                    color: AppTheme.primary, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
                child: Text(name, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final msg = _messages[i];
                      final isMe = msg['sender_id'] == userId;
                      return _MessageBubble(msg: msg, isMe: isMe);
                    },
                  ),
                ),
                _InputBar(
                  controller: _messageCtrl,
                  sending: _sending,
                  onSend: _send,
                ),
              ],
            ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> msg;
  final bool isMe;

  const _MessageBubble({required this.msg, required this.isMe});

  @override
  Widget build(BuildContext context) {
    final body = msg['body'] as String? ?? '';
    final ts =
        DateTime.tryParse(msg['created_at'] as String? ?? '');

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.72),
        margin: const EdgeInsets.only(bottom: 8),
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? AppTheme.primary : AppTheme.placeholder,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isMe ? 18 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 18),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              body,
              style: TextStyle(
                  color: isMe ? Colors.white : AppTheme.textDark,
                  fontSize: 15),
            ),
            if (ts != null) ...[
              const SizedBox(height: 4),
              Text(
                '${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}',
                style: TextStyle(
                    fontSize: 10,
                    color: isMe
                        ? Colors.white70
                        : AppTheme.textSecondary),
              ),
            ]
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  const _InputBar(
      {required this.controller,
      required this.sending,
      required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: AppTheme.surface(context),
        border: Border(top: BorderSide(color: AppTheme.divider)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              decoration: const InputDecoration(
                hintText: 'Message...',
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          sending
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                      color: AppTheme.primary, strokeWidth: 2))
              : GestureDetector(
                  onTap: onSend,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: AppTheme.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.send,
                        color: Colors.white, size: 18),
                  ),
                ),
        ],
      ),
    );
  }
}
