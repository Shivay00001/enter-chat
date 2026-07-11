import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// You will need to initialize this in main.dart before using the app.
// await Supabase.initialize(url: 'YOUR_SUPABASE_URL', anonKey: 'YOUR_ANON_KEY');

final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});
