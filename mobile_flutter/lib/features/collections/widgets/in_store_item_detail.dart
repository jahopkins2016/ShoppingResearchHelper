import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';

/// Full-screen detail view for an in-store captured item: photo gallery,
/// store/location info, and extracted product fields.
class InStoreItemDetail extends StatefulWidget {
  final Map<String, dynamic> item;

  const InStoreItemDetail({super.key, required this.item});

  @override
  State<InStoreItemDetail> createState() => _InStoreItemDetailState();
}

class _InStoreItemDetailState extends State<InStoreItemDetail> {
  final _page = PageController();
  int _index = 0;

  List<String> get _photos {
    final raw = widget.item['photo_urls'];
    if (raw is List) return raw.whereType<String>().toList();
    return const [];
  }

  Future<void> _openMap() async {
    final lat = widget.item['latitude'];
    final lng = widget.item['longitude'];
    if (lat == null || lng == null) return;
    final label = Uri.encodeComponent(widget.item['store_name']?.toString() ?? 'Captured here');
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng&query_place_id=$label');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final photos = _photos;
    final capturedAt = DateTime.tryParse(item['captured_at']?.toString() ?? '')?.toLocal();
    final hasCoords = item['latitude'] != null && item['longitude'] != null;

    return Scaffold(
      appBar: AppBar(title: Text(item['title']?.toString() ?? 'In-store item')),
      body: ListView(
        children: [
          if (photos.isNotEmpty)
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                children: [
                  PageView.builder(
                    controller: _page,
                    itemCount: photos.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (_, i) => CachedNetworkImage(
                      imageUrl: photos[i],
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
                  ),
                  if (photos.length > 1)
                    Positioned(
                      bottom: 12,
                      left: 0,
                      right: 0,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(photos.length, (i) {
                          final active = i == _index;
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            width: active ? 10 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: active ? Colors.white : Colors.white54,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          );
                        }),
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item['brand'] != null)
                  Text(item['brand'].toString(),
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppTheme.textSecondary,
                            fontWeight: FontWeight.w700,
                          )),
                if (item['title'] != null)
                  Text(item['title'].toString(),
                      style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                if (item['price'] != null)
                  Text(
                    '${item['currency'] ?? ''} ${item['price']}'.trim(),
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 20,
                    ),
                  ),
                const SizedBox(height: 16),
                _row('Size', item['size']),
                _row('Colour', item['color']),
                _row('Notes', item['notes']),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 12),
                Text('Where & when',
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                if (item['store_name'] != null)
                  _row('Store', item['store_name']),
                if (item['store_address'] != null)
                  _row('Address', item['store_address']),
                if (capturedAt != null)
                  _row('Captured',
                      '${capturedAt.year}-${_pad(capturedAt.month)}-${_pad(capturedAt.day)} ${_pad(capturedAt.hour)}:${_pad(capturedAt.minute)}'),
                if (hasCoords) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _openMap,
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Open in Maps'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, dynamic value) {
    if (value == null || value.toString().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 13,
                )),
          ),
          Expanded(
            child: Text(value.toString(),
                style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  static String _pad(int n) => n.toString().padLeft(2, '0');
}
