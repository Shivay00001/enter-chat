import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'route_names.dart';
import '../../features/auth/application/providers/auth_providers.dart';
import '../../features/auth/presentation/screens/phone_input_screen.dart';
import '../../features/auth/presentation/screens/otp_verify_screen.dart';
import '../../features/auth/presentation/screens/profile_setup_screen.dart';
import '../../features/chats/presentation/screens/chats_list_screen.dart';
import '../../features/chats/presentation/screens/chat_screen.dart';
import '../../features/calls/presentation/screens/calls_list_screen.dart';
import '../../features/updates/presentation/screens/updates_screen.dart';
import '../../features/discover/presentation/screens/discover_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/settings/presentation/screens/profile_screen.dart';
import '../../features/groups/presentation/screens/create_group_screen.dart';

/// App shell with bottom navigation.
class AppShell extends StatelessWidget {
  final Widget child;
  final int currentIndex;

  const AppShell({
    required this.child,
    required this.currentIndex,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) => _onTap(context, index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Chats'),
          NavigationDestination(icon: Icon(Icons.call_outlined), selectedIcon: Icon(Icons.call), label: 'Calls'),
          NavigationDestination(icon: Icon(Icons.circle_outlined), selectedIcon: Icon(Icons.circle), label: 'Updates'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Discover'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0: context.go(RouteNames.chats); break;
      case 1: context.go(RouteNames.calls); break;
      case 2: context.go(RouteNames.updates); break;
      case 3: context.go(RouteNames.discover); break;
      case 4: context.go(RouteNames.settings); break;
    }
  }
}

/// GoRouter configuration with auth redirect guard.
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: RouteNames.chats,
    redirect: (context, state) {
      final isLoggedIn = authState.status == AuthStatus.authenticated;
      final isAuthRoute = state.matchedLocation == RouteNames.login ||
          state.matchedLocation == RouteNames.otpVerify ||
          state.matchedLocation == RouteNames.profileSetup;
      final isInitializing = authState.status == AuthStatus.initial;

      // Still loading auth state — don't redirect yet
      if (isInitializing) return null;

      // Not logged in and not on an auth route → redirect to login
      if (!isLoggedIn && !isAuthRoute) return RouteNames.login;

      // Logged in and on auth route → redirect to chats
      if (isLoggedIn && isAuthRoute) return RouteNames.chats;

      return null;
    },
    routes: [
      // --- Auth routes ---
      GoRoute(
        path: RouteNames.login,
        name: 'login',
        builder: (context, state) => const PhoneInputScreen(),
      ),
      GoRoute(
        path: RouteNames.otpVerify,
        name: 'otpVerify',
        builder: (context, state) {
          final verificationId = state.extra as String? ?? '';
          return OtpVerifyScreen(verificationId: verificationId);
        },
      ),
      GoRoute(
        path: RouteNames.profileSetup,
        name: 'profileSetup',
        builder: (context, state) => const ProfileSetupScreen(),
      ),

      // --- Main app with shell ---
      ShellRoute(
        builder: (context, state, child) {
          final index = _indexForLocation(state.matchedLocation);
          return AppShell(currentIndex: index, child: child);
        },
        routes: [
          GoRoute(
            path: RouteNames.chats,
            name: 'chats',
            builder: (context, state) => const ChatsListScreen(),
            routes: [
              GoRoute(
                path: ':chatId',
                name: 'chat',
                builder: (context, state) {
                  final chatId = state.pathParameters['chatId']!;
                  return ChatScreen(chatId: chatId);
                },
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.calls,
            name: 'calls',
            builder: (context, state) => const CallsListScreen(),
          ),
          GoRoute(
            path: RouteNames.updates,
            name: 'updates',
            builder: (context, state) => const UpdatesScreen(),
          ),
          GoRoute(
            path: RouteNames.discover,
            name: 'discover',
            builder: (context, state) => const DiscoverScreen(),
          ),
          GoRoute(
            path: RouteNames.settings,
            name: 'settings',
            builder: (context, state) => const SettingsScreen(),
            routes: [
              GoRoute(
                path: 'profile',
                name: 'profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // --- Standalone routes (outside shell) ---
      GoRoute(
        path: RouteNames.createGroup,
        name: 'createGroup',
        builder: (context, state) => const CreateGroupScreen(),
      ),
    ],
  );
});

int _indexForLocation(String location) {
  if (location.startsWith(RouteNames.chats)) return 0;
  if (location.startsWith(RouteNames.calls)) return 1;
  if (location.startsWith(RouteNames.updates)) return 2;
  if (location.startsWith(RouteNames.discover)) return 3;
  if (location.startsWith(RouteNames.settings)) return 4;
  return 0;
}
