import 'package:flutter/material.dart';
import '../../../../core/widgets/empty_state.dart';

/// Calls tab — call history list.
class CallsListScreen extends StatelessWidget {
  const CallsListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Calls', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('New call contact picker launched (Stub)')),
          );
        },
        child: const Icon(Icons.call),
      ),
      body: ListView(
        children: [
          // Link row
          ListTile(
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
              child: Icon(Icons.link, color: Theme.of(context).colorScheme.primary),
            ),
            title: const Text('Create call link'),
            subtitle: const Text('Share a link for your EnterChat call'),
            onTap: () {},
          ),
          const Divider(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text('Recent', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          ),
          const SizedBox(height: 60),
          const Center(
            child: EmptyState(
              icon: Icons.phone_disabled,
              title: 'No recent calls',
              subtitle: 'Your recent voice and video calls will appear here.',
            ),
          ),
        ],
      ),
    );
  }
}

enum CallType { audio, video }

class _CallHistoryTile extends StatelessWidget {
  final String name;
  final String time;
  final CallType type;
  final bool incoming;
  final bool missed;

  const _CallHistoryTile({
    required this.name,
    required this.time,
    required this.type,
    this.incoming = true,
    this.missed = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
        child: Text(name[0], style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
      ),
      title: Text(name, style: TextStyle(color: missed ? Colors.red : null)),
      subtitle: Row(
        children: [
          Icon(
            incoming ? Icons.call_received : Icons.call_made,
            size: 14,
            color: missed ? Colors.red : Colors.green,
          ),
          const SizedBox(width: 4),
          Text(time, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      trailing: Icon(
        type == CallType.video ? Icons.videocam_outlined : Icons.call_outlined,
        color: Theme.of(context).colorScheme.primary,
      ),
      onTap: () {},
    );
  }
}
