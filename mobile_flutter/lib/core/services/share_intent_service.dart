import 'dart:async';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

class ShareIntentService {
  static final ShareIntentService _instance = ShareIntentService._();
  factory ShareIntentService() => _instance;
  ShareIntentService._();

  StreamSubscription? _sub;
  final _controller = StreamController<String>.broadcast();

  Stream<String> get sharedUrls => _controller.stream;
  String? _pendingUrl;
  String? get pendingUrl => _pendingUrl;

  void clearPending() => _pendingUrl = null;

  void init() {
    // Handle shared content when app is already running
    _sub = ReceiveSharingIntent.instance.getMediaStream().listen((list) {
      for (final media in list) {
        if (media.path.isNotEmpty) {
          _pendingUrl = media.path;
          _controller.add(media.path);
        }
      }
    });

    // Handle shared content when app is cold-started
    ReceiveSharingIntent.instance.getInitialMedia().then((list) {
      for (final media in list) {
        if (media.path.isNotEmpty) {
          _pendingUrl = media.path;
          _controller.add(media.path);
        }
      }
      ReceiveSharingIntent.instance.reset();
    });
  }

  void dispose() {
    _sub?.cancel();
    _controller.close();
  }
}
