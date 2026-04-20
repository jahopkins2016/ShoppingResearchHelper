import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/providers/auth_provider.dart';
import 'core/providers/theme_provider.dart';
import 'core/services/share_intent_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/collections/collections_screen.dart';
import 'features/collections/collection_detail_screen.dart';
import 'features/collections/widgets/share_collection_picker.dart';
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
  StreamSubscription<Uri>? _appLinkSub;
  final AppLinks _appLinks = AppLinks();
  AuthProvider? _authProvider;

  @override
  void initState() {
    super.initState();
    _shareSub = ShareIntentService().sharedUrls.listen(_onSharedUrl);
    _initAppLinks();
  }

  Future<void> _initAppLinks() async {
    // Handle cold-start: app launched by tapping a universal/app link.
    try {
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) _onIncomingUri(initialUri);
    } catch (e) {
      debugPrint('app_links getInitialLink failed: $e');
    }
    // Handle warm-start: app already running when a link is tapped.
    _appLinkSub = _appLinks.uriLinkStream.listen(
      _onIncomingUri,
      onError: (Object e) => debugPrint('app_links stream error: $e'),
    );
  }

  void _onIncomingUri(Uri uri) {
    debugPrint('Incoming deep link: $uri');
    // Only handle our own domain for now.
    if (uri.host != 'saveit.website') return;
    // /join?ref=CODE — a referral link. The router's redirect logic will
    // route unauthed users to /login and authed users to /collections,
    // which is the desired behaviour for now. If we later want to apply
    // the ref= code at signup, capture uri.queryParameters['ref'] here
    // and stash it for the signup flow to read.
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.read<AuthProvider>();
    if (_authProvider != auth) {
      _authProvider?.removeListener(_onAuthChanged);
      _authProvider = auth;
      _authProvider!.addListener(_onAuthChanged);
    }
    // Cold-start case: a URL may have been captured before we subscribed
    // to the broadcast stream. Check the pending buffer once the frame is up.
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryShowPending());
  }

  @override
  void dispose() {
    _authProvider?.removeListener(_onAuthChanged);
    _shareSub?.cancel();
    _appLinkSub?.cancel();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_authProvider?.isAuthenticated ?? false) {
      // Auth just came online — retry any URL we buffered while unauthenticated.
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryShowPending());
    }
  }

  void _tryShowPending() {
    final pending = ShareIntentService().pendingUrl;
    if (pending != null) _onSharedUrl(pending);
  }

  void _onSharedUrl(String url) {
    // If we're not authenticated yet, leave the URL buffered; _onAuthChanged
    // will retry once the user signs in.
    final authProvider = _authProvider ?? context.read<AuthProvider>();
    if (!authProvider.isAuthenticated) return;

    final navContext = _rootNavigatorKey.currentContext;
    if (navContext == null) return;

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
      // The iOS share extension wakes the app via a custom URL scheme
      // (ShareMedia-<bundle>:share). iOS hands that to Flutter as the
      // initial route, which go_router can't match. Swallow it here so
      // the user lands on /collections instead of the error page; the
      // receive_sharing_intent plugin picks up the shared URL separately.
      onException: (context, state, router) {
        router.go('/collections');
      },
      redirect: (context, state) {
        final isLoggedIn = authProvider.isAuthenticated;
        final isOnAuth = state.matchedLocation == '/login';
        if (!isLoggedIn && !isOnAuth) return '/login';
        if (isLoggedIn && isOnAuth) return '/collections';
        // Legacy /shared deep link — redirect to merged collections view.
        if (state.matchedLocation == '/shared') return '/collections';
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
      darkTheme: AppTheme.dark,
      themeMode: context.watch<ThemeProvider>().themeMode,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
