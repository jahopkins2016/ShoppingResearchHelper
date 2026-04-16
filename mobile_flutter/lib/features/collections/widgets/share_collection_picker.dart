import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_theme.dart';

class ShareCollectionPicker extends StatefulWidget {
  final String sharedUrl;
  const ShareCollectionPicker({super.key, required this.sharedUrl});

  @override
  State<ShareCollectionPicker> createState() => _ShareCollectionPickerState();
}

class _ShareCollectionPickerState extends State<ShareCollectionPicker> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _collections = [];
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadCollections();
  }

  Future<void> _loadCollections() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    final data = await _supabase
        .from('collections')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    if (mounted) {
      setState(() {
        _collections = List<Map<String, dynamic>>.from(data);
        _loading = false;
      });
    }
  }

  Future<void> _saveToCollection(String collectionId) async {
    setState(() => _saving = true);
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    try {
      final data = await _supabase.from('items').insert({
        'url': widget.sharedUrl,
        'collection_id': collectionId,
        'user_id': user.id,
        'enrichment_status': 'pending',
      }).select().single();

      _supabase.functions.invoke('enrich-item', body: {'item_id': data['id']});

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Item saved!')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
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
          const SizedBox(height: 20),
          Text('Save to Collection',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.link, size: 18, color: AppTheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.sharedUrl,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_collections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'No collections yet. Create one first!',
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            )
          else
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.4,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _collections.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final collection = _collections[index];
                  return ListTile(
                    leading: const Icon(Icons.folder_outlined,
                        color: AppTheme.primary),
                    title: Text(collection['name'] ?? 'Untitled'),
                    trailing: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.add_circle_outline,
                            color: AppTheme.primary),
                    onTap: _saving
                        ? null
                        : () => _saveToCollection(collection['id']),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
