import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class CollectionCard extends StatelessWidget {
  final Map<String, dynamic> collection;
  final VoidCallback onTap;

  const CollectionCard(
      {super.key, required this.collection, required this.onTap});

  List<String> _getImageUrls() {
    final thumbnails = collection['_thumbnails'] as List? ?? [];
    return thumbnails.cast<String>().take(4).toList();
  }

  @override
  Widget build(BuildContext context) {
    final name = collection['name'] as String? ?? 'Untitled';
    final isPublic = collection['is_public'] as bool? ?? false;
    final isArchived = collection['archived_at'] != null;
    final ownership = collection['_ownership'] as String? ?? 'mine';
    final sharedCount = collection['_sharedCount'] as int? ?? 0;
    final ownerName = collection['_ownerName'] as String?;
    final shareRole = collection['_shareRole'] as String?;
    final items = collection['items'] as List? ?? [];
    final itemCount = items.isNotEmpty && items.first is Map
        ? (items.first['count'] as int? ?? 0)
        : items.length;
    final imageUrls = _getImageUrls();

    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: isArchived ? 0.6 : 1.0,
        child: Container(
          decoration: BoxDecoration(
            color: AppTheme.surface(context),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.dividerColor(context)),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: imageUrls.isEmpty
                          ? Container(
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Center(
                                child: Icon(Icons.grid_view_rounded,
                                    color: AppTheme.primary, size: 32),
                              ),
                            )
                          : _ImageGrid(urls: imageUrls),
                    ),
                    if (ownership == 'shared_with_me')
                      Positioned(
                        top: 6,
                        left: 6,
                        child: _Badge(
                          icon: Icons.folder_shared_outlined,
                          label: shareRole == 'editor' ? 'Editor' : 'Viewer',
                        ),
                      ),
                    if (ownership == 'mine' && sharedCount > 0)
                      Positioned(
                        top: 6,
                        right: 6,
                        child: _Badge(
                          icon: Icons.people_alt_outlined,
                          label: '$sharedCount',
                        ),
                      ),
                    if (isArchived)
                      Positioned(
                        bottom: 6,
                        left: 6,
                        child: _Badge(
                          icon: Icons.archive_outlined,
                          label: 'Archived',
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
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
              if (ownership == 'shared_with_me' && ownerName != null) ...[
                const SizedBox(height: 2),
                Text('by $ownerName',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppTheme.textSecondary)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Badge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.55),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: Colors.white),
          const SizedBox(width: 3),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ImageGrid extends StatelessWidget {
  final List<String> urls;
  const _ImageGrid({required this.urls});

  Widget _buildImage(String url) {
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, __) => Container(color: AppTheme.primaryLight),
      errorWidget: (_, __, ___) => Container(
        color: AppTheme.primaryLight,
        child: const Icon(Icons.image_not_supported_outlined,
            color: AppTheme.textSecondary, size: 20),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (urls.length == 1) {
      return SizedBox.expand(child: _buildImage(urls[0]));
    }
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 2,
      mainAxisSpacing: 2,
      physics: const NeverScrollableScrollPhysics(),
      children: urls.map(_buildImage).toList(),
    );
  }
}
