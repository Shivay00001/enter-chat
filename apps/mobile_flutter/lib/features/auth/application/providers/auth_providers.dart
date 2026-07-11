import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;
import '../../../../core/network/supabase_client.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/user.dart';

// --- Auth state ---
enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final User? user;
  final String? error;
  final String? phone; // Kept during OTP flow
  final String? verificationId; // Added for routing to OTP screen

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.error,
    this.phone,
    this.verificationId,
  });

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    String? error,
    String? phone,
    String? verificationId,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      error: error,
      phone: phone ?? this.phone,
      verificationId: verificationId ?? this.verificationId,
    );
  }
}

// --- Auth notifier ---
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final client = ref.read(supabaseClientProvider);
  final apiClient = ref.read(apiClientProvider);
  return AuthNotifier(client, apiClient);
});

class AuthNotifier extends StateNotifier<AuthState> {
  final supabase.SupabaseClient _supabase;
  final ApiClient _apiClient; // Used for syncing our custom backend

  AuthNotifier(this._supabase, this._apiClient) : super(const AuthState()) {
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final session = _supabase.auth.currentSession;
    if (session != null) {
      await _syncWithBackend(session.user.phone);
    } else {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }

    // Listen to Auth State changes automatically
    _supabase.auth.onAuthStateChange.listen((data) async {
      final event = data.event;
      if (event == supabase.AuthChangeEvent.signedOut) {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    });
  }

  Future<void> startOtp({required String channel, required String identifier}) async {
    state = state.copyWith(status: AuthStatus.loading, phone: identifier);
    try {
      if (channel == 'sms') {
        await _supabase.auth.signInWithOtp(phone: identifier);
      } else {
        await _supabase.auth.signInWithOtp(email: identifier);
      }
      state = state.copyWith(status: AuthStatus.unauthenticated);
    } catch (e) {
      state = state.copyWith(status: AuthStatus.error, error: e.toString());
    }
  }

  Future<bool> verifyOtp({required String otp}) async {
    if (state.phone == null) return false;

    state = state.copyWith(status: AuthStatus.loading);
    try {
      final response = await _supabase.auth.verifyOTP(
        type: supabase.OtpType.sms,
        token: otp,
        phone: state.phone!,
      );

      if (response.session != null) {
        await _syncWithBackend(state.phone);
        return true;
      }
      return false;
    } catch (e) {
      state = state.copyWith(status: AuthStatus.error, error: e.toString());
      return false;
    }
  }

  Future<void> _syncWithBackend(String? phone) async {
    try {
      // Calls the /v1/auth/sync backend route to create the PostgresWallet & Profile
      final res = await _apiClient.post('/v1/auth/sync', data: {'phone': phone});
      final userData = res.data['user'];
      final user = User.fromJson(userData);
      
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (e) {
      state = state.copyWith(status: AuthStatus.error, error: 'Backend sync failed: $e');
    }
  }

  Future<void> logout() async {
    try {
      await _supabase.auth.signOut();
    } finally {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> updateProfile({String? displayName, String? username, String? statusText}) async {
    // Still uses our backend API to update public.users
    try {
      final res = await _apiClient.put('/v1/users/me', data: {
        'displayName': displayName,
        'username': username,
        'statusText': statusText,
      });
      state = state.copyWith(user: User.fromJson(res.data));
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }
}
