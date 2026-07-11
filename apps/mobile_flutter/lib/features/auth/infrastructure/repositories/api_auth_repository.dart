import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';
import '../../../../core/storage/secure_storage.dart';

/// API-backed auth repository — connects to the real backend.
class ApiAuthRepository implements AuthRepository {
  final ApiClient _apiClient;
  final SecureStorage _secureStorage;

  ApiAuthRepository({required ApiClient apiClient, required SecureStorage secureStorage})
      : _apiClient = apiClient,
        _secureStorage = secureStorage;

  @override
  Future<String> startOtp({required String channel, required String identifier}) async {
    final response = await _apiClient.post(
      ApiConfig.authOtpStart,
      data: {'channel': channel, 'identifier': identifier},
    );
    return response.data['verificationId'] as String;
  }

  @override
  Future<AuthTokens> verifyOtp({
    required String verificationId,
    required String otp,
    required String platform,
    String? deviceName,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.authOtpVerify,
      data: {
        'verificationId': verificationId,
        'otp': otp,
        'device': {
          'platform': platform,
          'deviceName': deviceName ?? 'Flutter App',
        },
      },
    );

    final tokens = AuthTokens.fromJson(response.data as Map<String, dynamic>);

    // Store tokens securely
    await _secureStorage.setAccessToken(tokens.accessToken);
    await _secureStorage.setRefreshToken(tokens.refreshToken);
    await _secureStorage.setUserId(tokens.user.id);

    return tokens;
  }

  @override
  Future<AuthTokens> refreshToken(String refreshToken) async {
    final response = await _apiClient.post(
      ApiConfig.authTokenRefresh,
      data: {'refreshToken': refreshToken},
    );

    final tokens = AuthTokens.fromJson(response.data as Map<String, dynamic>);

    await _secureStorage.setAccessToken(tokens.accessToken);
    await _secureStorage.setRefreshToken(tokens.refreshToken);

    return tokens;
  }

  @override
  Future<void> logout() async {
    try {
      await _apiClient.post(ApiConfig.authLogout);
    } finally {
      await _secureStorage.clearAll();
    }
  }

  @override
  Future<User> getCurrentUser() async {
    final response = await _apiClient.get(ApiConfig.usersMe);
    return User.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<User> updateProfile({String? displayName, String? username, String? statusText}) async {
    final data = <String, dynamic>{};
    if (displayName != null) data['displayName'] = displayName;
    if (username != null) data['username'] = username;
    if (statusText != null) data['statusText'] = statusText;

    final response = await _apiClient.patch(ApiConfig.usersMeProfile, data: data);
    return User.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<bool> isAuthenticated() async {
    final token = await _secureStorage.getAccessToken();
    return token != null;
  }
}
