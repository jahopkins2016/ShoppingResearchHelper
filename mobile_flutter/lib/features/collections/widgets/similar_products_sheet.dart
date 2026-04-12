import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_theme.dart';

class SimilarProductsSheet extends StatefulWidget {
  final String itemId;
  final String itemTitle;

  const SimilarProductsSheet(
      {super.key, required this.itemId, required this.itemTitle});

  @override
  State<SimilarProductsSheet> createState() => _SimilarProductsSheetState();
}

class _SimilarProductsSheetState extends State<SimilarProductsSheet> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await _supabase
        .from('similar_products')
        .select()
        .eq('item_id', widget.itemId)
        .order('created_at', ascending: false);
    if (!mounted) return;
    setState(() {
      _products = List<Map<String, dynamic>>.from(data);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
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
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
              child: Text('Similar to ${widget.itemTitle}',
                  style: Theme.of(context).textTheme.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ),
            const Divider(),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: AppTheme.primary))
                  : _products.isEmpty
                      ? Center(
                          child: Text('No similar products found',
                              style: Theme.of(context).textTheme.bodyMedium))
                      : ListView.builder(
                          controller: controller,
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.all(16),
                          itemCount: _products.length,
                          itemBuilder: (_, i) =>
                              _SimilarCard(product: _products[i]),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SimilarCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _SimilarCard({required this.product});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final url = product['url'] as String?;
        if (url == null) return;
        final uri = Uri.tryParse(url);
        if (uri != null && await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Container(
        width: 160,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.divider),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (product['image_url'] != null)
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(12)),
                child: CachedNetworkImage(
                  imageUrl: product['image_url'],
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => Container(
                    height: 120,
                    color: AppTheme.placeholder,
                    child: const Icon(Icons.image_outlined,
                        size: 32, color: AppTheme.textSecondary),
                  ),
                ),
              )
            else
              Container(
                height: 120,
                decoration: const BoxDecoration(
                  color: AppTheme.placeholder,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: const Center(
                  child: Icon(Icons.image_outlined,
                      size: 32, color: AppTheme.textSecondary),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product['title'] ?? '',
                    style: Theme.of(context).textTheme.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (product['price'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${product['currency'] != null ? '${product['currency']} ' : ''}${product['price']}',
                      style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                    ),
                  ],
                  if (product['site_name'] != null) ...[
                    const SizedBox(height: 2),
                    Text(product['site_name'],
                        style: Theme.of(context).textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
