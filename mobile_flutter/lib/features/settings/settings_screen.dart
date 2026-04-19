import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart' show Share;
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _profile;
  String? _version;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() => _version = 'v${info.version}+${info.buildNumber}');
    }
  }

  Future<void> _loadProfile() async {
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;
    final data = await _supabase
        .from('profiles')
        .select()
        .eq('id', userId)
        .single();
    if (mounted) setState(() => _profile = data);
  }

  Future<void> _signOut() async {
    await _supabase.auth.signOut();
  }

  void _shareReferral() {
    final code = _profile?['referral_code'] as String?;
    if (code == null) return;
    Share.share(
      'Join me on SaveIt — the smart product bookmarking app! Use my referral code $code to sign up.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final name =
        _profile?['display_name'] ?? _profile?['email'] ?? 'User';
    final email = _supabase.auth.currentUser?.email ?? '';
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          // Profile card
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppTheme.primaryLight,
                  child: Text(initial,
                      style: const TextStyle(
                          color: AppTheme.primary,
                          fontSize: 28,
                          fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(email,
                          style: Theme.of(context).textTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // App Preferences
          const _SectionHeader(title: 'App Preferences'),
          _SettingsTile(
            icon: Icons.notifications_outlined,
            label: 'Notifications',
            subtitle: 'Price drops, messages, invites',
            onTap: () => context.push('/settings/notifications'),
          ),
          _SettingsTile(
            icon: Icons.palette_outlined,
            label: 'Appearance',
            subtitle: 'Theme, font size',
            onTap: () => context.push('/settings/appearance'),
          ),
          const SizedBox(height: 8),
          // Security & Privacy
          const _SectionHeader(title: 'Security & Privacy'),
          _SettingsTile(
            icon: Icons.lock_outline,
            label: 'Privacy',
            subtitle: 'Data, visibility, and account',
            onTap: () => context.push('/settings/privacy'),
          ),
          const SizedBox(height: 8),
          // Share & Support
          const _SectionHeader(title: 'Share & Support'),
          _SettingsTile(
            icon: Icons.card_giftcard_outlined,
            label: 'Refer a Friend',
            subtitle: _profile?['referral_code'] != null
                ? 'Code: ${_profile!['referral_code']}'
                : 'Share your referral code',
            onTap: _shareReferral,
            trailing: const Icon(Icons.share_outlined,
                size: 18, color: AppTheme.textSecondary),
          ),
          _SettingsTile(
            icon: Icons.help_outline,
            label: 'Help & Support',
            onTap: () => context.push('/settings/help'),
          ),
          const SizedBox(height: 8),
          // Sign out
          Container(
            color: Colors.white,
            child: ListTile(
              leading: const Icon(Icons.logout, color: AppTheme.danger),
              title: const Text('Sign Out',
                  style: TextStyle(color: AppTheme.danger)),
              onTap: _signOut,
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              _version ?? '',
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(title.toUpperCase(),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700, letterSpacing: 0.5)),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final Widget? trailing;

  const _SettingsTile({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: ListTile(
        leading: Icon(icon, color: AppTheme.textSecondary),
        title: Text(label, style: Theme.of(context).textTheme.bodyLarge),
        subtitle: subtitle != null ? Text(subtitle!) : null,
        trailing: trailing ??
            const Icon(Icons.chevron_right,
                color: AppTheme.textSecondary),
        onTap: onTap,
      ),
    );
  }
}
