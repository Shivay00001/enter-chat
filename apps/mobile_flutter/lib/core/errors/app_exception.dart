/// Application-level exception types.
/// Used across all features for consistent error handling.
sealed class AppException implements Exception {
  final String message;
  final String? code;

  const AppException(this.message, {this.code});

  @override
  String toString() => 'AppException($code): $message';
}

/// Server returned a validation error (400).
class ValidationException extends AppException {
  final List<Map<String, String>>? details;
  const ValidationException(super.message, {super.code, this.details});
}

/// Authentication failed — token expired or invalid (401).
class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Unauthorized']) : super(message, code: 'UNAUTHORIZED');
}

/// User does not have permission (403).
class ForbiddenException extends AppException {
  const ForbiddenException([String message = 'Forbidden']) : super(message, code: 'FORBIDDEN');
}

/// Resource not found (404).
class NotFoundException extends AppException {
  const NotFoundException([String message = 'Not found']) : super(message, code: 'NOT_FOUND');
}

/// Rate limited (429).
class RateLimitException extends AppException {
  final int retryAfterSeconds;
  const RateLimitException({this.retryAfterSeconds = 60, String message = 'Too many requests'})
      : super(message, code: 'RATE_LIMITED');
}

/// Network error — no connectivity.
class NetworkException extends AppException {
  const NetworkException([String message = 'No internet connection']) : super(message, code: 'NETWORK_ERROR');
}

/// Server error (500+).
class ServerException extends AppException {
  const ServerException([String message = 'Server error']) : super(message, code: 'SERVER_ERROR');
}
