import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_theme.dart';

class PriceHistorySheet extends StatefulWidget {
  final String itemId;
  final String itemTitle;
  final VoidCallback onDismissPriceDrop;
  final bool hasPriceDrop;

  const PriceHistorySheet({
    super.key,
    required this.itemId,
    required this.itemTitle,
    required this.onDismissPriceDrop,
    required this.hasPriceDrop,
  });

  @override
  State<PriceHistorySheet> createState() => _PriceHistorySheetState();
}

class _PriceHistorySheetState extends State<PriceHistorySheet> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await _supabase
        .from('price_history')
        .select()
        .eq('item_id', widget.itemId)
        .order('checked_at', ascending: false);
    if (!mounted) return;
    setState(() {
      _history = List<Map<String, dynamic>>.from(data);
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
        color: AppTheme.surface(context),
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
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Price History',
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  if (widget.hasPriceDrop)
                    TextButton.icon(
                      onPressed: () {
                        widget.onDismissPriceDrop();
                        Navigator.pop(context);
                      },
                      icon: const Icon(Icons.done, size: 16),
                      label: const Text('Dismiss drop'),
                      style: TextButton.styleFrom(
                          foregroundColor: AppTheme.success),
                    ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: AppTheme.primary))
                  : _history.isEmpty
                      ? Center(
                          child: Text('No price history yet',
                              style: Theme.of(context).textTheme.bodyMedium))
                      : ListView.separated(
                          controller: controller,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 8),
                          itemCount: _history.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final row = _history[i];
                            final date = DateTime.tryParse(
                                row['checked_at'] as String? ?? '');
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                '${row['currency'] != null ? '${row['currency']} ' : ''}${row['price'] ?? '—'}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                ),
                              ),
                              trailing: date != null
                                  ? Text(
                                      '${_months[date.month - 1]} ${date.day}, ${date.year}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall,
                                    )
                                  : null,
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  static const _months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
}
