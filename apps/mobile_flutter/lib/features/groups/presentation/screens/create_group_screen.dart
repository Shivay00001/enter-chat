import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';

/// Create group screen.
class CreateGroupScreen extends ConsumerStatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  ConsumerState<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends ConsumerState<CreateGroupScreen> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Group'),
        actions: [
          _isLoading 
            ? const Padding(
                padding: EdgeInsets.only(right: 16.0),
                child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
              )
            : TextButton(
                onPressed: _nameController.text.trim().isNotEmpty ? _onCreate : null,
                child: const Text('Create'),
              ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Image picker launched (Stub)')),
                    );
                  },
                  child: CircleAvatar(
                    radius: 32,
                    backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.2),
                    child: Icon(Icons.camera_alt, color: Theme.of(context).colorScheme.primary),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(hintText: 'Group name'),
                    textCapitalization: TextCapitalization.words,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
               controller: _descController,
               decoration: const InputDecoration(hintText: 'Group description (optional)'),
               maxLines: 3,
            ),
            const SizedBox(height: 24),
            ListTile(
              leading: CircleAvatar(
                backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                child: Icon(Icons.person_add, color: Theme.of(context).colorScheme.primary),
              ),
              title: const Text('Add members'),
              subtitle: const Text('Select contacts to add'),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Contact picker launched (Stub)')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onCreate() async {
    setState(() => _isLoading = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      
      await apiClient.post(
        ApiConfig.chats,
        data: {
          'chatType': 'group',
          'name': _nameController.text.trim(),
          if (_descController.text.trim().isNotEmpty) 'description': _descController.text.trim(),
          'participantIds': [], // In real app, these would come from contact picker
        },
      );
      
      if (mounted) {
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create group: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}

