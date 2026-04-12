import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_theme.dart';

class EditCollectionSheet extends StatefulWidget {
  final Map<String, dynamic> collection;
  final VoidCallback onUpdated;

  const EditCollectionSheet(
      {super.key, required this.collection, required this.onUpdated});

  @override
  State<EditCollectionSheet> createState() => _EditCollectionSheetState();
}

class _EditCollectionSheetState extends State<EditCollectionSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late bool _isPublic;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl =
        TextEditingController(text: widget.collection['name'] as String? ?? '');
    _descCtrl = TextEditingController(
        text: widget.collection['description'] as String? ?? '');
    _isPublic = widget.collection['is_public'] as bool? ?? false;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      await Supabase.instance.client.from('collections').update({
        'name': _nameCtrl.text.trim(),
        'description':
            _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'is_public': _isPublic,
      }).eq('id', widget.collection['id']);
      if (mounted) {
        Navigator.of(context).pop();
        widget.onUpdated();
      }
    } finally {
      if (mounted) setState(() => _saving = false);
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
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 20),
          Text('Edit Collection',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtrl,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Collection name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descCtrl,
            decoration: const InputDecoration(
                labelText: 'Description (optional)'),
          ),
          const SizedBox(height: 12),
          SwitchListTile.adaptive(
            value: _isPublic,
            onChanged: (v) => setState(() => _isPublic = v),
            title: const Text('Public collection'),
            contentPadding: EdgeInsets.zero,
            activeThumbColor: AppTheme.primary,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : const Text('Save Changes'),
          ),
        ],
      ),
    );
  }
}
