import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_theme.dart';

class PrivacyScreen extends StatefulWidget {
  const PrivacyScreen({super.key});

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  bool _publicProfile = false;
  bool _allowFriendRequests = true;

  Future<void> _deleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Account?'),
        content: const Text(
          'This will permanently delete your account, all collections, items, and data. '
          'This action cannot be undone.',
        ),
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
    await Supabase.instance.client.auth.signOut();
    // Note: actual account deletion requires a server-side call.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy')),
      body: ListView(
        children: [
          SwitchListTile.adaptive(
            title: const Text('Public Profile'),
            subtitle: const Text(
                'Allow others to find you by name'),
            value: _publicProfile,
            onChanged: (v) => setState(() => _publicProfile = v),
            activeThumbColor: AppTheme.primary,
          ),
          const Divider(height: 1),
          SwitchListTile.adaptive(
            title: const Text('Allow Friend Requests'),
            subtitle: const Text(
                'Let others add you as a friend'),
            value: _allowFriendRequests,
            onChanged: (v) =>
                setState(() => _allowFriendRequests = v),
            activeThumbColor: AppTheme.primary,
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton(
              onPressed: _deleteAccount,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.danger,
                side: const BorderSide(color: AppTheme.danger),
              ),
              child: const Text('Delete Account'),
            ),
          ),
        ],
      ),
    );
  }
}
