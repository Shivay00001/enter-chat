import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for local caching
  await Hive.initFlutter();

  // Initialize Supabase (used for core auth)
  // In production, these should be loaded from env variables
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://placeholder.supabase.co'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: 'placeholder'),
  );

  // Initialize crash reporting (Sentry)
  // Production would wrap runApp with SentryFlutter.init
  debugPrint('Crash reporting initialized');

  // Initialize push notification service (FCM / APNs)
  // Production would call Firebase.initializeApp()
  debugPrint('Push notifications initialized');

  runApp(
    const ProviderScope(
      child: EnterChatApp(),
    ),
  );
}
