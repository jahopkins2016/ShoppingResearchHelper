import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
  // Invite token captured from a cold-start deep link while the user
  // was unauthenticated. Applied once auth completes.
  String? _pendingInviteToken;

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

    // /join?invite=<token> — collection share invite.
    if (uri.path.startsWith('/join')) {
      final invite = uri.queryParameters['invite'];
      if (invite != null && invite.isNotEmpty) {
        _handleInviteToken(invite);
        return;
      }
      // /join?ref=<code> — referral. The router already routes the
      // user to /login or /collections based on auth state, nothing
      // more to do here at the moment.
    }
  }

  /// Accepts a collection-share invite token via the
  /// accept_collection_invite RPC. If the user isn't signed in yet,
  /// we stash the token; _onAuthChanged retries once auth completes.
  Future<void> _handleInviteToken(String token) async {
    final auth = _authProvider ?? context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      _pendingInviteToken = token;
      return;
    }
    try {
      final result = await Supabase.instance.client
          .rpc('accept_collection_invite', params: {'p_token': token});
      final collectionId = result as String?;
      final navContext = _rootNavigatorKey.currentContext;
      if (collectionId != null && navContext != null) {
        GoRouter.of(navContext).go('/collections/$collectionId');
        ScaffoldMessenger.of(navContext).showSnackBar(
          const SnackBar(
            content: Text('Invite accepted — you can now see this collection.'),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e, st) {
      debugPrint('accept_collection_invite failed: $e\n$st');
      final navContext = _rootNavigatorKey.currentContext;
      if (navContext != null) {
        ScaffoldMessenger.of(navContext).showSnackBar(
          SnackBar(content: Text('Could not accept invite: $e')),
        );
      }
    }
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
      // And apply any invite token that arrived via deep link pre-auth.
      final token = _pendingInviteToken;
      if (token != null) {
        _pendingInviteToken = null;
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _handleInviteToken(token));
      }
    }
  }

  void _tryShowPending() {
    final pending = ShareIntentService().pendingUrl;
    if (pending != null) _onSharedUrl(pending);
  }

  void _onSharedUrl(String url) {
    // Our own share links (e.g. https://saveit.website/join?ref=XXX)
    // arrive here on Android because the intent-filter's ACTION_VIEW
    // gets picked up by receive_sharing_intent in addition to app_links.
    // Don't offer to bookmark them as product items — they're referral
    // / invite links. Route them through the deep-link handler instead.
    try {
      final uri = Uri.parse(url);
      if (uri.host == 'saveit.website') {
        ShareIntentService().clearPending();
        _onIncomingUri(uri);
        return;
      }
    } catch (_) {
      // Fall through to the normal share flow on parse failure.
    }

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
