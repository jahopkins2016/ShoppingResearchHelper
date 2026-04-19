import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_theme.dart';

/// Full metadata inspector for an item — mirrors the web InspectModal. Shows
/// every non-null column plus price history in a scrollable table.
class MetadataInspectorSheet extends StatelessWidget {
  final Map<String, dynamic> item;

  const MetadataInspectorSheet({super.key, required this.item});

  static const _fieldOrder = <String>[
    'id',
    'source',
    'url',
    'title',
    'description',
    'image_url',
    'cached_image_path',
    'price',
    'currency',
    'sale_price',
    'original_price',
    'lowest_price',
    'brand',
    'category',
    'availability',
    'condition',
    'rating',
    'rating_count',
    'review_count',
    'seller',
    'color',
    'size',
    'shipping',
    'return_policy',
    'site_name',
    'enrichment_status',
    'updated_at',
    'sku',
    'gtin',
    'additional_images',
    'photo_urls',
    'photo_classifications',
    'store_name',
    'store_address',
    'latitude',
    'longitude',
    'captured_at',
    'notes',
    'product_metadata',
  ];

  @override
  Widget build(BuildContext context) {
    final entries = <MapEntry<String, dynamic>>[];
    for (final key in _fieldOrder) {
      final v = item[key];
      if (v == null) continue;
      if (v is String && v.isEmpty) continue;
      if (v is List && v.isEmpty) continue;
      if (v is Map && v.isEmpty) continue;
      entries.add(MapEntry(_prettyLabel(key), v));
    }

    final history = List<Map<String, dynamic>>.from(item['price_history'] ?? [])
      ..sort((a, b) => (b['checked_at'] ?? '').toString().compareTo((a['checked_at'] ?? '').toString()));

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: ListView(
          controller: scrollCtrl,
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
            const SizedBox(height: 12),
            Row(
              children: [
                Text('Metadata Inspector',
                    style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...entries.map((e) => _row(context, e.key, e.value)),
            if (history.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('Price History (${history.length})',
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 6),
              ...history.map((h) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_fmtDate(h['checked_at']?.toString()),
                            style: Theme.of(context).textTheme.bodySmall),
                        Text(
                          '${h['currency'] ?? ''} ${h['price'] ?? '—'}'.trim(),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, dynamic value) {
    Widget valueWidget;
    if (value is String && (value.startsWith('http://') || value.startsWith('https://'))) {
      valueWidget = InkWell(
        onTap: () async {
          final uri = Uri.tryParse(value);
          if (uri != null && await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        child: Text(
          value,
          style: const TextStyle(color: AppTheme.primary, fontSize: 13, decoration: TextDecoration.underline),
        ),
      );
    } else if (value is List || value is Map) {
      final pretty = const JsonEncoder.withIndent('  ').convert(value);
      valueWidget = GestureDetector(
        onLongPress: () {
          Clipboard.setData(ClipboardData(text: pretty));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Copied'), duration: Duration(seconds: 1)),
          );
        },
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppTheme.placeholder,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(pretty,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
        ),
      );
    } else {
      valueWidget = SelectableText(value.toString(), style: const TextStyle(fontSize: 13));
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              )),
          const SizedBox(height: 2),
          valueWidget,
          const Divider(height: 16),
        ],
      ),
    );
  }

  static String _prettyLabel(String k) {
    return k
        .split('_')
        .map((s) => s.isEmpty ? s : (s[0].toUpperCase() + s.substring(1)))
        .join(' ');
  }

  static String _fmtDate(String? iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    return d.toLocal().toString().split('.').first;
  }
}
