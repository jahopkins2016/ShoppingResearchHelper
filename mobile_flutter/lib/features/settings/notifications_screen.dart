import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _priceDrops = true;
  bool _messages = true;
  bool _collectionInvites = true;
  bool _friendRequests = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        children: [
          const _SectionHeader('Price Tracking'),
          SwitchListTile.adaptive(
            title: const Text('Price drop alerts'),
            subtitle: const Text('Notify me when a saved item drops in price'),
            value: _priceDrops,
            onChanged: (v) => setState(() => _priceDrops = v),
            activeThumbColor: AppTheme.primary,
          ),
          const Divider(height: 1),
          const _SectionHeader('Social'),
          SwitchListTile.adaptive(
            title: const Text('New messages'),
            subtitle: const Text('Notify me when I receive a message'),
            value: _messages,
            onChanged: (v) => setState(() => _messages = v),
            activeThumbColor: AppTheme.primary,
          ),
          const Divider(height: 1),
          SwitchListTile.adaptive(
            title: const Text('Collection invites'),
            subtitle: const Text('Notify me when someone shares a collection'),
            value: _collectionInvites,
            onChanged: (v) =>
                setState(() => _collectionInvites = v),
            activeThumbColor: AppTheme.primary,
          ),
          const Divider(height: 1),
          SwitchListTile.adaptive(
            title: const Text('Friend requests'),
            subtitle: const Text('Notify me when someone adds me as a friend'),
            value: _friendRequests,
            onChanged: (v) =>
                setState(() => _friendRequests = v),
            activeThumbColor: AppTheme.primary,
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Push notification delivery requires your device notification permissions to be enabled.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text(title.toUpperCase(),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700, letterSpacing: 0.5)),
      );
}
