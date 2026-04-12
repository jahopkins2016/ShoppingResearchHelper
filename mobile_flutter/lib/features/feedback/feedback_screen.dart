import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _supabase = Supabase.instance.client;
  final _messageCtrl = TextEditingController();
  String _category = 'general';
  bool _submitting = false;
  List<Map<String, dynamic>> _history = [];
  bool _loadingHistory = true;

  static const _categories = [
    ('bug', 'Bug Report'),
    ('feature', 'Feature Request'),
    ('general', 'General'),
    ('complaint', 'Complaint'),
  ];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() => _loadingHistory = true);
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;
    final data = await _supabase
        .from('feedback')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    if (!mounted) return;
    setState(() {
      _history = List<Map<String, dynamic>>.from(data);
      _loadingHistory = false;
    });
  }

  Future<void> _submit() async {
    final message = _messageCtrl.text.trim();
    if (message.isEmpty) return;
    setState(() => _submitting = true);
    final userId = context.read<AuthProvider>().userId;
    try {
      await _supabase.from('feedback').insert({
        'user_id': userId,
        'category': _category,
        'message': message,
        'status': 'open',
      });
      _messageCtrl.clear();
      _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Feedback submitted. Thank you!')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'open':
        return AppTheme.primary;
      case 'in_progress':
        return AppTheme.warning;
      case 'closed':
        return AppTheme.success;
      default:
        return AppTheme.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Category picker
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: _categories
                  .map((c) => DropdownMenuItem(
                        value: c.$1,
                        child: Text(c.$2),
                      ))
                  .toList(),
              onChanged: (v) =>
                  setState(() => _category = v ?? 'general'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _messageCtrl,
              minLines: 4,
              maxLines: 8,
              decoration: const InputDecoration(
                labelText: 'Your message',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Feedback'),
            ),
            const SizedBox(height: 24),
            if (_loadingHistory)
              const Center(child: CircularProgressIndicator())
            else if (_history.isNotEmpty) ...[
              Text('Your Submissions',
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              ..._history.map((f) {
                final status = f['status'] as String? ?? 'open';
                final cat = f['category'] as String? ?? '';
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(f['message'] ?? '',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    subtitle: Text(cat.toUpperCase()),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: _statusColor(status).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                            color: _statusColor(status),
                            fontSize: 11,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}
