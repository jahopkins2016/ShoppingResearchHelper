import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_theme.dart';

// Kept in sync with the web app's production URL (see send-invite-email edge
// function's SITE_URL default).
const _siteUrl = 'https://web-weld-two-36.vercel.app';

class ShareCollectionSheet extends StatefulWidget {
  final Map<String, dynamic> collection;
  final VoidCallback onChanged;

  const ShareCollectionSheet({
    super.key,
    required this.collection,
    required this.onChanged,
  });

  @override
  State<ShareCollectionSheet> createState() => _ShareCollectionSheetState();
}

class _ShareCollectionSheetState extends State<ShareCollectionSheet> {
  final _supabase = Supabase.instance.client;
  final _emailCtrl = TextEditingController();

  late bool _isPublic;
  String _role = 'viewer';
  bool _busy = false;
  List<Map<String, dynamic>> _shares = [];

  String get _publicUrl => '$_siteUrl/c/${widget.collection['id']}';
  String? get _inviteUrl {
    final token = widget.collection['invite_token'] as String?;
    if (token == null || token.isEmpty) return null;
    return '$_siteUrl/join?invite=$token';
  }

  @override
  void initState() {
    super.initState();
    _isPublic = widget.collection['is_public'] as bool? ?? false;
    _loadShares();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadShares() async {
    final rows = await _supabase
        .from('collection_shares')
        .select('id, shared_with_email, role, status')
        .eq('collection_id', widget.collection['id'])
        .order('created_at', ascending: false);
    if (!mounted) return;
    setState(() => _shares = List<Map<String, dynamic>>.from(rows));
  }

  Future<void> _togglePublic(bool v) async {
    setState(() => _isPublic = v);
    await _supabase
        .from('collections')
        .update({'is_public': v}).eq('id', widget.collection['id']);
    widget.onChanged();
  }

  Future<void> _copyLink() async {
    await Clipboard.setData(ClipboardData(text: _publicUrl));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Link copied')),
    );
  }

  Future<void> _shareInviteLink() async {
    var url = _inviteUrl;
    if (url == null) {
      // Collection row didn't include invite_token — fetch/generate one and
      // reflect it on the widget's collection map for subsequent shares.
      final row = await _supabase
          .from('collections')
          .select('invite_token')
          .eq('id', widget.collection['id'])
          .single();
      final token = row['invite_token'] as String?;
      if (token == null || token.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not generate invite link')),
        );
        return;
      }
      widget.collection['invite_token'] = token;
      url = '$_siteUrl/join?invite=$token';
    }
    final name = widget.collection['name'] as String? ?? 'Collection';
    await Share.share(
      'Check out my SaveIt collection "$name": $url',
      subject: name,
    );
  }

  Future<void> _invite() async {
    final email = _emailCtrl.text.trim().toLowerCase();
    if (email.isEmpty || !email.contains('@')) return;

    final user = _supabase.auth.currentUser;
    if (user == null) return;

    setState(() => _busy = true);
    try {
      final inserted = await _supabase
          .from('collection_shares')
          .insert({
            'collection_id': widget.collection['id'],
            'shared_by': user.id,
            'shared_with_email': email,
            'role': _role,
          })
          .select('id')
          .single();

      // Fire-and-forget email; surface failure to the user without blocking.
      _supabase.functions
          .invoke('send-invite-email', body: {'share_id': inserted['id']});

      _emailCtrl.clear();
      await _loadShares();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invite sent to $email')),
      );
    } on PostgrestException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not invite: ${e.message}')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke(String shareId) async {
    await _supabase.from('collection_shares').delete().eq('id', shareId);
    await _loadShares();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('Share "${widget.collection['name'] ?? ''}"',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 20),

            // Primary action: native share sheet with invite link
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _shareInviteLink,
                icon: const Icon(Icons.ios_share, size: 18),
                label: const Text('Share invite link'),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Anyone with the link can join as a viewer.',
              style: Theme.of(context).textTheme.bodySmall,
            ),

            const SizedBox(height: 24),
            const Divider(height: 1),
            const SizedBox(height: 16),

            // Secondary: invite by email (can grant editor role)
            Text('Invite by email',
                style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration:
                        const InputDecoration(hintText: 'name@example.com'),
                  ),
                ),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _role,
                  items: const [
                    DropdownMenuItem(
                        value: 'viewer', child: Text('Viewer')),
                    DropdownMenuItem(
                        value: 'editor', child: Text('Editor')),
                  ],
                  onChanged: (v) =>
                      setState(() => _role = v ?? 'viewer'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _busy ? null : _invite,
              child: _busy
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Send Invite'),
            ),

            if (_shares.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('People with access',
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              ..._shares.map((s) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(s['shared_with_email'] ?? ''),
                    subtitle: Text(
                        '${s['role']} · ${s['status']}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.close,
                          size: 18, color: AppTheme.danger),
                      onPressed: () => _revoke(s['id']),
                    ),
                  )),
            ],

            const SizedBox(height: 24),
            const Divider(height: 1),
            const SizedBox(height: 16),

            // Secondary: public link toggle
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _isPublic,
              onChanged: _togglePublic,
              title: const Text('Also make this collection public'),
              subtitle: const Text(
                  'Anyone with the link can view it on the web.'),
              activeThumbColor: AppTheme.primary,
            ),
            if (_isPublic) ...[
              const SizedBox(height: 4),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.placeholder,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _publicUrl,
                        style: Theme.of(context).textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _copyLink,
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Copy link'),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
