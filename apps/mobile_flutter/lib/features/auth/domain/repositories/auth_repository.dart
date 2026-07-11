import '../entities/user.dart';

/// Auth repository port — swappable between mock and API implementations.
abstract class AuthRepository {
  /// Start OTP verification.
  Future<String> startOtp({required String channel, required String identifier});

  /// Verify OTP and get tokens.
  Future<AuthTokens> verifyOtp({
    required String verificationId,
    required String otp,
    required String platform,
    String? deviceName,
  });

  /// Refresh access token.
  Future<AuthTokens> refreshToken(String refreshToken);

  /// Logout / revoke session.
  Future<void> logout();

  /// Get current user profile.
  Future<User> getCurrentUser();

  /// Update profile.
  Future<User> updateProfile({String? displayName, String? username, String? statusText});

  /// Check if user is authenticated (has stored tokens).
  Future<bool> isAuthenticated();
}
