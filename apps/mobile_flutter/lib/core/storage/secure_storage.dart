import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Secure storage wrapper for sensitive data (tokens, keys).
/// Uses platform keychain/keystore — never stores tokens in plain Hive/SharedPrefs.
class SecureStorage {
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _userIdKey = 'user_id';

  final FlutterSecureStorage _storage;

  SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  // --- Access Token ---
  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);

  Future<void> setAccessToken(String token) =>
      _storage.write(key: _accessTokenKey, value: token);

  Future<void> deleteAccessToken() => _storage.delete(key: _accessTokenKey);

  // --- Refresh Token ---
  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> setRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  Future<void> deleteRefreshToken() => _storage.delete(key: _refreshTokenKey);

  // --- User ID ---
  Future<String?> getUserId() => _storage.read(key: _userIdKey);

  Future<void> setUserId(String userId) =>
      _storage.write(key: _userIdKey, value: userId);

  // --- Clear all ---
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
