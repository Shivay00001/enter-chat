/// Named route constants. Single source of truth for all route paths.
class RouteNames {
  RouteNames._();

  // Auth
  static const String login = '/login';
  static const String otpVerify = '/otp-verify';
  static const String profileSetup = '/profile-setup';

  // Main tabs
  static const String chats = '/chats';
  static const String calls = '/calls';
  static const String updates = '/updates';
  static const String discover = '/discover';
  static const String settings = '/settings';

  // Chats sub-routes
  static String chat(String chatId) => '/chats/$chatId';

  // Settings sub-routes
  static const String profile = '/settings/profile';

  // Standalone
  static const String createGroup = '/create-group';
}
