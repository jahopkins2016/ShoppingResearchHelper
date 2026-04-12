import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';

class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key});

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _comparisons = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final userId = context.read<AuthProvider>().userId;
    if (userId == null) return;
    final data = await _supabase
        .from('item_comparisons')
        .select('*, comparison_items(count)')
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    if (!mounted) return;
    setState(() {
      _comparisons = List<Map<String, dynamic>>.from(data);
      _loading = false;
    });
  }

  Future<void> _createComparison() async {
    final userId = context.read<AuthProvider>().userId;
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New Comparison'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration:
              const InputDecoration(labelText: 'Comparison name'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () =>
                  Navigator.pop(context, ctrl.text.trim()),
              child: const Text('Create')),
        ],
      ),
    );
    ctrl.dispose();
    if (name == null || name.isEmpty) return;

    await _supabase
        .from('item_comparisons')
        .insert({'user_id': userId, 'name': name});
    _load();
  }

  Future<void> _deleteComparison(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete comparison?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete',
                  style: TextStyle(color: AppTheme.danger))),
        ],
      ),
    );
    if (confirmed != true) return;
    await _supabase.from('item_comparisons').delete().eq('id', id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compare'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _createComparison,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppTheme.primary))
          : _comparisons.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.compare_arrows_rounded,
                          size: 56, color: AppTheme.textSecondary),
                      const SizedBox(height: 16),
                      Text('No comparisons yet',
                          style:
                              Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: _createComparison,
                        icon: const Icon(Icons.add),
                        label: const Text('New Comparison'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _comparisons.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final comp = _comparisons[i];
                      final count =
                          (comp['comparison_items'] as List?)
                                  ?.firstOrNull?['count'] ??
                              0;
                      return ListTile(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: AppTheme.divider),
                        ),
                        tileColor: Colors.white,
                        leading: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.compare_arrows_rounded,
                              color: AppTheme.primary, size: 22),
                        ),
                        title: Text(comp['name'] ?? 'Untitled',
                            style:
                                Theme.of(context).textTheme.titleSmall),
                        subtitle: Text('$count item${count == 1 ? '' : 's'}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.chevron_right,
                                color: AppTheme.textSecondary),
                            IconButton(
                              icon: const Icon(Icons.delete_outline,
                                  color: AppTheme.danger, size: 18),
                              onPressed: () =>
                                  _deleteComparison(comp['id'] as String),
                              splashRadius: 20,
                            ),
                          ],
                        ),
                        onTap: () =>
                            context.push('/compare/${comp['id']}'),
                      );
                    },
                  ),
                ),
    );
  }
}
