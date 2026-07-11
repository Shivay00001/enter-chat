import 'package:dio/dio.dart';
import '../../storage/secure_storage.dart';
import '../api_config.dart';

/// Interceptor that attaches auth tokens and handles token refresh.
/// SECURITY: Tokens are read from secure storage, never from memory globals.
class AuthInterceptor extends Interceptor {
  final Dio dio;
  final SecureStorage secureStorage;
  bool _isRefreshing = false;

  AuthInterceptor({required this.dio, required this.secureStorage});

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Skip auth for auth endpoints
    final noAuthPaths = [
      ApiConfig.authOtpStart,
      ApiConfig.authOtpVerify,
      ApiConfig.authTokenRefresh,
    ];
    if (noAuthPaths.any((p) => options.path.contains(p))) {
      return handler.next(options);
    }

    final token = await secureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Auto-refresh on 401 (token expired)
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken = await secureStorage.getRefreshToken();
        if (refreshToken == null) {
          _isRefreshing = false;
          return handler.next(err);
        }

        // Attempt token refresh
        final response = await Dio(BaseOptions(baseUrl: ApiConfig.baseUrl)).post(
          ApiConfig.authTokenRefresh,
          data: {'refreshToken': refreshToken},
        );

        if (response.statusCode == 200) {
          final newAccessToken = response.data['accessToken'] as String;
          final newRefreshToken = response.data['refreshToken'] as String;

          await secureStorage.setAccessToken(newAccessToken);
          await secureStorage.setRefreshToken(newRefreshToken);

          // Retry original request with new token
          err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
          final retryResponse = await dio.fetch(err.requestOptions);
          _isRefreshing = false;
          return handler.resolve(retryResponse);
        }
      } catch (_) {
        // Refresh failed — clear tokens, user needs to re-login
        await secureStorage.clearAll();
      }
      _isRefreshing = false;
    }
    handler.next(err);
  }
}
