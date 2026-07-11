import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../app/app.dart';
import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/app_avatar.dart';
import '../../../auth/application/providers/auth_providers.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';

/// Settings tab — wired to Riverpod for auth state, theme, logout, delete account.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final userName = authState.user?.displayName ?? 'Your Name';
    final statusText = authState.user?.statusText ?? 'Available';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: ListView(
        children: [
          // Profile header
          InkWell(
            onTap: () => context.go(RouteNames.profile),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  AppAvatar(
                    name: userName,
                    imageUrl: authState.user?.avatarUrl,
                    radius: 32,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(userName, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 4),
                        Text(statusText, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Icon(Icons.qr_code, color: Theme.of(context).colorScheme.primary),
                ],
              ),
            ),
          ),
          const Divider(),

          _SettingsSection(title: 'Account', items: [
            _SettingsItem(icon: Icons.key, title: 'Account', subtitle: 'Privacy, security, change number'),
            _SettingsItem(icon: Icons.lock_outline, title: 'Privacy', subtitle: 'Last seen, profile photo, about'),
            _SettingsItem(icon: Icons.security, title: 'Security', subtitle: 'Encryption, device verification'),
          ]),

          _SettingsSection(title: 'App', items: [
            _SettingsItem(
              icon: Icons.palette_outlined,
              title: 'Appearance',
              subtitle: 'Theme, font size, wallpaper',
              onTap: () => _showThemePicker(context, ref),
            ),
            _SettingsItem(icon: Icons.notifications_outlined, title: 'Notifications', subtitle: 'Message, group, call tones'),
            _SettingsItem(icon: Icons.storage_outlined, title: 'Storage and data', subtitle: 'Network usage, auto-download'),
            _SettingsItem(icon: Icons.language, title: 'Language', subtitle: 'English'),
          ]),

          _SettingsSection(title: 'Legal', items: [
            _SettingsItem(
              icon: Icons.description_outlined,
              title: 'Privacy Policy',
              onTap: () => _openUrl('https://enterchat.app/privacy-policy'),
            ),
            _SettingsItem(
              icon: Icons.gavel_outlined,
              title: 'Terms of Service',
              onTap: () => _openUrl('https://enterchat.app/terms'),
            ),
            _SettingsItem(
              icon: Icons.shield_outlined,
              title: 'Data Privacy',
              subtitle: 'Your data, your control',
              onTap: () => _showDataPrivacySheet(context),
            ),
          ]),

          _SettingsSection(title: 'Support', items: [
            _SettingsItem(
              icon: Icons.help_outline,
              title: 'Help & FAQ',
              onTap: () => _openUrl('https://enterchat.app/contact'),
            ),
            _SettingsItem(icon: Icons.feedback_outlined, title: 'Send Feedback', onTap: () => _showFeedbackDialog(context)),
            _SettingsItem(icon: Icons.group_outlined, title: 'Invite friends'),
          ]),

          const SizedBox(height: 8),

          // Logout
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.brandWarning),
            title: const Text('Log out', style: TextStyle(color: AppColors.brandWarning)),
            onTap: () => _confirmLogout(context, ref),
          ),

          // Delete account
          ListTile(
            leading: const Icon(Icons.delete_forever, color: AppColors.brandDanger),
            title: const Text('Delete Account', style: TextStyle(color: AppColors.brandDanger)),
            subtitle: const Text('Permanently delete your account and data'),
            onTap: () => _confirmDeleteAccount(context, ref),
          ),

          const SizedBox(height: 24),

          // App version
          Center(
            child: Text(
              'EnterChat v0.1.0 (MVP)',
              style: TextStyle(fontSize: 12, color: Theme.of(context).textTheme.bodySmall?.color),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  void _showThemePicker(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Choose theme', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          ),
          ListTile(
            leading: const Icon(Icons.brightness_auto),
            title: const Text('System default'),
            onTap: () { ref.read(themeModeProvider.notifier).state = ThemeMode.system; Navigator.pop(context); },
          ),
          ListTile(
            leading: const Icon(Icons.light_mode),
            title: const Text('Light'),
            onTap: () { ref.read(themeModeProvider.notifier).state = ThemeMode.light; Navigator.pop(context); },
          ),
          ListTile(
            leading: const Icon(Icons.dark_mode),
            title: const Text('Dark'),
            onTap: () { ref.read(themeModeProvider.notifier).state = ThemeMode.dark; Navigator.pop(context); },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log out'),
        content: const Text('Are you sure you want to log out? You can log back in anytime.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Log out', style: TextStyle(color: AppColors.brandWarning)),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAccount(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber, color: AppColors.brandDanger),
            SizedBox(width: 8),
            Text('Delete Account'),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('This action is permanent and cannot be undone.\n'),
            Text('Deleting your account will remove:', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text('• All your messages'),
            Text('• Your profile and contacts'),
            Text('• Group memberships'),
            Text('• All uploaded media'),
            Text('• Call history'),
            SizedBox(height: 12),
            Text('Your data will be permanently erased within 90 days.'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await ref.read(apiClientProvider).delete(ApiConfig.account);
                ref.read(authProvider.notifier).logout();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Account deletion initiated. Your data will be removed within 90 days.'),
                      duration: Duration(seconds: 5),
                    ),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed to delete account: $e')),
                  );
                }
              }
            },
            child: const Text('Delete Account', style: TextStyle(color: AppColors.brandDanger)),
          ),
        ],
      ),
    );
  }

  void _showDataPrivacySheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.all(24),
          child: ListView(
            controller: scrollController,
            children: [
              const Text('Data Privacy', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _DataPrivacyItem(
                icon: Icons.chat_bubble_outline,
                title: 'Messages',
                description: 'End-to-end encrypted. We cannot read your messages.',
              ),
              _DataPrivacyItem(
                icon: Icons.phone_outlined,
                title: 'Phone Number',
                description: 'Stored as a cryptographic hash. Your raw number is never stored.',
              ),
              _DataPrivacyItem(
                icon: Icons.location_off_outlined,
                title: 'Location',
                description: 'Never tracked. Location sharing is user-initiated only.',
              ),
              _DataPrivacyItem(
                icon: Icons.analytics_outlined,
                title: 'Analytics',
                description: 'No third-party analytics SDKs. No ad tracking.',
              ),
              _DataPrivacyItem(
                icon: Icons.storage_outlined,
                title: 'Data Storage',
                description: 'All data encrypted at rest and in transit (TLS 1.2+).',
              ),
              _DataPrivacyItem(
                icon: Icons.download_outlined,
                title: 'Data Export',
                description: 'Request a complete export of your data anytime.',
              ),
              _DataPrivacyItem(
                icon: Icons.delete_outline,
                title: 'Right to Delete',
                description: 'Delete your account and all data permanently.',
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => _openUrl('https://enterchat.app/privacy-policy'),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Full Privacy Policy'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFeedbackDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Send Feedback'),
        content: TextField(
          controller: controller,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Tell us what you think...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Thanks for your feedback! 🙏')),
              );
            },
            child: const Text('Send'),
          ),
        ],
      ),
    );
  }

  void _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<_SettingsItem> items;

  const _SettingsSection({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.primary)),
        ),
        ...items,
        const Divider(),
      ],
    );
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  const _SettingsItem({required this.icon, required this.title, this.subtitle, this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Theme.of(context).textTheme.bodySmall?.color),
      title: Text(title),
      subtitle: subtitle != null ? Text(subtitle!, style: Theme.of(context).textTheme.bodySmall) : null,
      onTap: onTap ?? () {},
    );
  }
}

class _DataPrivacyItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;

  const _DataPrivacyItem({required this.icon, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.brandPrimary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 20, color: AppColors.brandPrimary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(description, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
