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
  final _newNameCtrl = TextEditingController();
  List<Map<String, dynamic>> _collections = [];
  bool _loading = true;
  bool _saving = false;
  bool _creatingNew = false;

  @override
  void initState() {
    super.initState();
    _loadCollections();
  }

  @override
  void dispose() {
    _newNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCollections() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    final data = await _supabase
        .from('collections')
        .select()
        .eq('user_id', userId)
        .isFilter('archived_at', null)
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

      final token = _supabase.auth.currentSession?.accessToken;
      _supabase.functions.invoke(
        'enrich-item',
        body: {'item_id': data['id']},
        headers: token != null ? {'Authorization': 'Bearer $token'} : null,
      );

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

  Future<void> _createAndSave() async {
    final name = _newNameCtrl.text.trim();
    if (name.isEmpty) return;
    final user = _supabase.auth.currentUser;
    if (user == null) return;
    setState(() => _saving = true);
    try {
      final newCollection = await _supabase
          .from('collections')
          .insert({
            'user_id': user.id,
            'name': name,
            'is_public': false,
          })
          .select()
          .single();
      await _saveToCollection(newCollection['id'] as String);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create collection: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottom),
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
          if (_creatingNew) _buildNewCollectionRow() else _buildNewCollectionTile(),
          const Divider(height: 1),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_collections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'No collections yet — create one above.',
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

  Widget _buildNewCollectionTile() {
    return ListTile(
      leading: const Icon(Icons.create_new_folder_outlined,
          color: AppTheme.primary),
      title: const Text('Create new collection'),
      onTap: _saving ? null : () => setState(() => _creatingNew = true),
    );
  }

  Widget _buildNewCollectionRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.create_new_folder_outlined,
              color: AppTheme.primary),
          const SizedBox(width: 16),
          Expanded(
            child: TextField(
              controller: _newNameCtrl,
              autofocus: true,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                hintText: 'Collection name',
                isDense: true,
              ),
              onSubmitted: (_) => _createAndSave(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check_circle, color: AppTheme.primary),
            onPressed: _saving ? null : _createAndSave,
            tooltip: 'Create and save',
          ),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: _saving
                ? null
                : () => setState(() {
                      _creatingNew = false;
                      _newNameCtrl.clear();
                    }),
          ),
        ],
      ),
    );
  }
}
