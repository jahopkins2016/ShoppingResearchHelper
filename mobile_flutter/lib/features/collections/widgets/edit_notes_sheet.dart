import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_theme.dart';

/// Bottom sheet for editing the free-text `notes` field on an item. Used for
/// both URL and in-store items.
class EditNotesSheet extends StatefulWidget {
  final String itemId;
  final String? initialNotes;
  final ValueChanged<String?> onSaved;

  const EditNotesSheet({
    super.key,
    required this.itemId,
    required this.initialNotes,
    required this.onSaved,
  });

  @override
  State<EditNotesSheet> createState() => _EditNotesSheetState();
}

class _EditNotesSheetState extends State<EditNotesSheet> {
  late final TextEditingController _ctrl =
      TextEditingController(text: widget.initialNotes ?? '');
  bool _saving = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final value = _ctrl.text.trim();
    final next = value.isEmpty ? null : value;
    try {
      await Supabase.instance.client
          .from('items')
          .update({'notes': next, 'updated_at': DateTime.now().toUtc().toIso8601String()})
          .eq('id', widget.itemId);
      widget.onSaved(next);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Notes', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: _ctrl,
              autofocus: true,
              maxLines: 6,
              minLines: 3,
              decoration: const InputDecoration(
                hintText: 'Add a comment for this item…',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                TextButton(
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                const Spacer(),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
