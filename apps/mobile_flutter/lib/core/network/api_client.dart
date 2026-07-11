import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_config.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/logging_interceptor.dart';
import '../storage/secure_storage.dart';
import '../errors/app_exception.dart';

/// Singleton Dio HTTP client with interceptors.
/// Handles auth token injection, refresh, logging, and error mapping.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(secureStorage: SecureStorage());
});

final secureStorageProvider = Provider<SecureStorage>((ref) {
  return SecureStorage();
});

class ApiClient {
  late final Dio _dio;
  final SecureStorage secureStorage;

  ApiClient({required this.secureStorage}) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.addAll([
      AuthInterceptor(dio: _dio, secureStorage: secureStorage),
      AppLoggingInterceptor(),
    ]);
  }

  Dio get dio => _dio;

  /// GET request with error mapping.
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// POST request with error mapping.
  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// PUT request with error mapping.
  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// PATCH request with error mapping.
  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
    Options? options,
  }) async {
    try {
      return await _dio.patch<T>(path, data: data, options: options);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// DELETE request with error mapping.
  Future<Response<T>> delete<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw _mapDioError(e);
    }
  }

  /// Map Dio errors to typed AppExceptions.
  AppException _mapDioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return const NetworkException('Connection timed out');
    }

    if (e.type == DioExceptionType.connectionError) {
      return const NetworkException();
    }

    final statusCode = e.response?.statusCode;
    final errorBody = e.response?.data;
    String message = 'An error occurred';
    String? code;

    if (errorBody is Map<String, dynamic>) {
      final error = errorBody['error'];
      if (error is Map<String, dynamic>) {
        message = error['message'] as String? ?? message;
        code = error['code'] as String?;
      }
    }

    switch (statusCode) {
      case 400:
        return ValidationException(message, code: code);
      case 401:
        return UnauthorizedException(message);
      case 403:
        return ForbiddenException(message);
      case 404:
        return NotFoundException(message);
      case 429:
        final retryAfter = (errorBody is Map<String, dynamic>)
            ? ((errorBody['error'] as Map?)?['retryAfterSeconds'] as int? ?? 60)
            : 60;
        return RateLimitException(retryAfterSeconds: retryAfter, message: message);
      default:
        if (statusCode != null && statusCode >= 500) {
          return ServerException(message);
        }
        return ServerException(message);
    }
  }
}
