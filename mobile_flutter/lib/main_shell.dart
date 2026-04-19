import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'features/collections/collections_screen.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell shell;

  const MainShell({super.key, required this.shell});

  static const _tabs = [
    _TabInfo(icon: Icons.grid_view_rounded, label: 'Collections'),
    _TabInfo(icon: Icons.people_outline, label: 'Friends'),
    _TabInfo(icon: Icons.chat_bubble_outline, label: 'Messages'),
    _TabInfo(icon: Icons.settings_outlined, label: 'Settings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: shell.currentIndex,
        onTap: (index) => shell.goBranch(
          index,
          initialLocation: index == shell.currentIndex,
        ),
        items: _tabs
            .map((t) => BottomNavigationBarItem(
                  icon: Icon(t.icon),
                  label: t.label,
                ))
            .toList(),
      ),
      floatingActionButton: _fabForTab(context, shell.currentIndex),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }

  Widget? _fabForTab(BuildContext context, int index) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location == '/collections') {
      return FloatingActionButton(
        heroTag: 'collections_fab',
        onPressed: () => _showNewCollectionDialog(context),
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      );
    }
    if (location == '/messages') {
      return FloatingActionButton(
        heroTag: 'messages_fab',
        onPressed: () => context.push('/messages/new'),
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.edit_outlined, color: Colors.white),
      );
    }
    return null;
  }

  void _showNewCollectionDialog(BuildContext context) {
    // Delegate to the collections screen via a ValueNotifier or direct call.
    // Using a simple exported GlobalKey approach.
    CollectionsScreen.createNew(context);
  }
}

class _TabInfo {
  final IconData icon;
  final String label;
  const _TabInfo({required this.icon, required this.label});
}
