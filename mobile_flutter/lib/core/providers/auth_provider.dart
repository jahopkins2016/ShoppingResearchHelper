import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthProvider extends ChangeNotifier {
  Session? _session;

  AuthProvider() {
    _session = Supabase.instance.client.auth.currentSession;
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      _session = data.session;
      notifyListeners();
    });
  }

  bool get isAuthenticated => _session != null;

  User? get currentUser => _session?.user;

  String? get userId => _session?.user.id;
}
