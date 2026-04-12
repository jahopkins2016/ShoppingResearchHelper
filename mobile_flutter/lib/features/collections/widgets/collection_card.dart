import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class CollectionCard extends StatelessWidget {
  final Map<String, dynamic> collection;
  final VoidCallback onTap;

  const CollectionCard(
      {super.key, required this.collection, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = collection['name'] as String? ?? 'Untitled';
    final isPublic = collection['is_public'] as bool? ?? false;
    final itemCount =
        (collection['items'] as List?)?.firstOrNull?['count'] ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.divider),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.grid_view_rounded,
                  color: AppTheme.primary, size: 28),
            ),
            const Spacer(),
            Text(
              name,
              style: Theme.of(context).textTheme.titleSmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text('$itemCount item${itemCount == 1 ? '' : 's'}',
                    style: Theme.of(context).textTheme.bodySmall),
                if (isPublic) ...[
                  const SizedBox(width: 6),
                  const Icon(Icons.public,
                      size: 12, color: AppTheme.textSecondary),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
