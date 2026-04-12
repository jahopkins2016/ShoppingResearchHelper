import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HelpTile(
            icon: Icons.book_outlined,
            title: 'Getting Started',
            subtitle: 'Learn the basics of SaveIt',
            onTap: () => _launch('https://saveit.app/docs'),
          ),
          _HelpTile(
            icon: Icons.quiz_outlined,
            title: 'FAQ',
            subtitle: 'Answers to common questions',
            onTap: () => _launch('https://saveit.app/faq'),
          ),
          _HelpTile(
            icon: Icons.email_outlined,
            title: 'Contact Support',
            subtitle: 'Get help from our team',
            onTap: () => _launch('mailto:support@saveit.app'),
          ),
          _HelpTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            onTap: () => _launch('https://saveit.app/privacy'),
          ),
          _HelpTile(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            onTap: () => _launch('https://saveit.app/terms'),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              'SaveIt v1.0.0',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _HelpTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  const _HelpTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppTheme.primary),
        title: Text(title, style: Theme.of(context).textTheme.bodyLarge),
        subtitle: subtitle != null ? Text(subtitle!) : null,
        trailing: const Icon(Icons.chevron_right,
            color: AppTheme.textSecondary),
        onTap: onTap,
      ),
    );
  }
}
