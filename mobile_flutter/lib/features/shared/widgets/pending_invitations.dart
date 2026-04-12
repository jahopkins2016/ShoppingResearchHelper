import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class PendingInvitations extends StatelessWidget {
  final List<Map<String, dynamic>> invitations;
  final Future<void> Function(String shareId, String status) onRespond;

  const PendingInvitations(
      {super.key, required this.invitations, required this.onRespond});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Pending Invitations',
            style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        ...invitations.map((inv) {
          final col = inv['collections'] as Map<String, dynamic>?;
          final sharedBy =
              inv['profiles'] as Map<String, dynamic>?;
          final senderName = sharedBy?['display_name'] ??
              sharedBy?['email'] ??
              'Someone';
          final colName =
              col?['name'] as String? ?? 'Untitled';
          final role = inv['role'] as String? ?? 'viewer';

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF9C3),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFDE047)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$senderName invited you to "$colName"',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        )),
                const SizedBox(height: 4),
                Text(
                  'As ${role == 'editor' ? 'an editor' : 'a viewer'}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () =>
                            onRespond(inv['id'] as String, 'declined'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.danger,
                          side: const BorderSide(color: AppTheme.danger),
                          minimumSize: const Size.fromHeight(36),
                        ),
                        child: const Text('Decline'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () =>
                            onRespond(inv['id'] as String, 'accepted'),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size.fromHeight(36),
                        ),
                        child: const Text('Accept'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
