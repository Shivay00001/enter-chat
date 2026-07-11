import 'dart:developer' as dev;
import 'package:dio/dio.dart';

/// Logging interceptor for development.
/// SECURITY: Never logs authorization headers, tokens, or sensitive body fields.
class AppLoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    dev.log(
      '→ ${options.method} ${options.path}',
      name: 'HTTP',
    );
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    dev.log(
      '← ${response.statusCode} ${response.requestOptions.method} ${response.requestOptions.path}',
      name: 'HTTP',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    dev.log(
      '✕ ${err.response?.statusCode ?? 'NETWORK'} ${err.requestOptions.method} ${err.requestOptions.path}: ${err.message}',
      name: 'HTTP',
      level: 1000,
    );
    handler.next(err);
  }
}
