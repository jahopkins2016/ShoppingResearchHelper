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
    final items = collection['items'] as List? ?? [];
    final itemCount = items.isNotEmpty && items.first is Map
        ? (items.first['count'] as int? ?? 0)
        : items.length;
    final imageUrls = _getImageUrls();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.divider),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
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
          ],
        ),
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
