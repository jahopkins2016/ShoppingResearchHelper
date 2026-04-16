import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/providers/auth_provider.dart';
import 'core/services/share_intent_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/collections/collections_screen.dart';
import 'features/collections/collection_detail_screen.dart';
import 'features/collections/widgets/share_collection_picker.dart';
import 'features/shared/shared_screen.dart';
import 'features/friends/friends_screen.dart';
import 'features/messages/messages_screen.dart';
import 'features/messages/conversation_screen.dart';
import 'features/compare/compare_screen.dart';
import 'features/compare/compare_detail_screen.dart';
import 'features/feedback/feedback_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/settings/notifications_screen.dart';
import 'features/settings/appearance_screen.dart';
import 'features/settings/privacy_screen.dart';
import 'features/settings/help_screen.dart';
import 'main_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

class SaveItApp extends StatefulWidget {
  const SaveItApp({super.key});

  @override
  State<SaveItApp> createState() => _SaveItAppState();
}

class _SaveItAppState extends State<SaveItApp> {
  StreamSubscription? _shareSub;

  @override
  void initState() {
    super.initState();
    _shareSub = ShareIntentService().sharedUrls.listen(_onSharedUrl);
  }

  @override
  void dispose() {
    _shareSub?.cancel();
    super.dispose();
  }

  void _onSharedUrl(String url) {
    final navContext = _rootNavigatorKey.currentContext;
    if (navContext == null) return;

    final authProvider = context.read<AuthProvider>();
    if (!authProvider.isAuthenticated) return;

    ShareIntentService().clearPending();

    showModalBottomSheet(
      context: navContext,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ShareCollectionPicker(sharedUrl: url),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    final router = GoRouter(
      navigatorKey: _rootNavigatorKey,
      refreshListenable: authProvider,
      initialLocation: '/collections',
      redirect: (context, state) {
        final isLoggedIn = authProvider.isAuthenticated;
        final isOnAuth = state.matchedLocation == '/login';
        if (!isLoggedIn && !isOnAuth) return '/login';
        if (isLoggedIn && isOnAuth) return '/collections';
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, __) => const LoginScreen(),
        ),
        StatefulShellRoute.indexedStack(
          builder: (_, __, shell) => MainShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/collections',
                builder: (_, __) => const CollectionsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) =>
                        CollectionDetailScreen(id: state.pathParameters['id']!),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/shared',
                builder: (_, __) => const SharedScreen(),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/friends',
                builder: (_, __) => const FriendsScreen(),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/messages',
                builder: (_, __) => const MessagesScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) =>
                        ConversationScreen(id: state.pathParameters['id']!),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/settings',
                builder: (_, __) => const SettingsScreen(),
                routes: [
                  GoRoute(
                    path: 'notifications',
                    builder: (_, __) => const NotificationsScreen(),
                  ),
                  GoRoute(
                    path: 'appearance',
                    builder: (_, __) => const AppearanceScreen(),
                  ),
                  GoRoute(
                    path: 'privacy',
                    builder: (_, __) => const PrivacyScreen(),
                  ),
                  GoRoute(
                    path: 'help',
                    builder: (_, __) => const HelpScreen(),
                  ),
                ],
              ),
            ]),
          ],
        ),
        GoRoute(
          path: '/compare',
          builder: (_, __) => const CompareScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) =>
                  CompareDetailScreen(id: state.pathParameters['id']!),
            ),
          ],
        ),
        GoRoute(
          path: '/feedback',
          builder: (_, __) => const FeedbackScreen(),
        ),
      ],
    );

    return MaterialApp.router(
      title: 'SaveIt',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
