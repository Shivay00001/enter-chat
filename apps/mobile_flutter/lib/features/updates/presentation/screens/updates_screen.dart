import 'package:flutter/material.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/app_avatar.dart';

/// Updates/Status tab — combines WhatsApp Status + Channel posts.
class UpdatesScreen extends StatelessWidget {
  const UpdatesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Updates', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'edit_status',
            onPressed: () {},
            backgroundColor: Theme.of(context).colorScheme.surface,
            child: Icon(Icons.edit, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(height: 12),
          FloatingActionButton(
            heroTag: 'camera_status',
            onPressed: () {},
            child: const Icon(Icons.camera_alt),
          ),
        ],
      ),
      body: ListView(
        children: [
          // My Status
          ListTile(
            leading: Stack(
              children: [
                const AppAvatar(name: 'You', radius: 24),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: AppColors.brandPrimary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 2),
                    ),
                    child: const Icon(Icons.add, size: 12, color: Colors.white),
                  ),
                ),
              ],
            ),
            title: const Text('My Status', style: TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Tap to add status update'),
            onTap: () {},
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text('Recent updates', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          ),
          const SizedBox(height: 40),
          const Center(
            child: Text(
              'No recent updates to show.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
          const SizedBox(height: 40),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text('Channels', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text(
              'You are not subscribed to any channels yet.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  final String name;
  final String time;
  final bool hasMultiple;

  const _StatusTile({required this.name, required this.time, this.hasMultiple = false});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.brandPrimary,
            width: 2,
            strokeAlign: BorderSide.strokeAlignOutside,
          ),
        ),
        child: AppAvatar(name: name, radius: 22),
      ),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(time, style: Theme.of(context).textTheme.bodySmall),
      onTap: () {},
    );
  }
}

class _ChannelTile extends StatelessWidget {
  final String name;
  final String update;
  final String time;

  const _ChannelTile({required this.name, required this.update, required this.time});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.brandAccent.withOpacity(0.1),
        child: Icon(Icons.campaign, color: AppColors.brandAccent),
      ),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(update, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: Text(time, style: Theme.of(context).textTheme.labelSmall),
      onTap: () {},
    );
  }
}
