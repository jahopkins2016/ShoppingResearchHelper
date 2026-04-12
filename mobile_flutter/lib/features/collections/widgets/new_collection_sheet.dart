import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';

class NewCollectionSheet extends StatefulWidget {
  final VoidCallback onCreated;

  const NewCollectionSheet({super.key, required this.onCreated});

  @override
  State<NewCollectionSheet> createState() => _NewCollectionSheetState();
}

class _NewCollectionSheetState extends State<NewCollectionSheet> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _isPublic = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    final userId =
        context.read<AuthProvider>().userId;
    try {
      await Supabase.instance.client.from('collections').insert({
        'user_id': userId,
        'name': _nameCtrl.text.trim(),
        'description':
            _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'is_public': _isPublic,
      });
      if (mounted) {
        Navigator.of(context).pop();
        widget.onCreated();
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
          // Handle
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
          Text('New Collection',
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
            subtitle:
                const Text('Anyone with the link can view'),
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
                : const Text('Create'),
          ),
        ],
      ),
    );
  }
}
