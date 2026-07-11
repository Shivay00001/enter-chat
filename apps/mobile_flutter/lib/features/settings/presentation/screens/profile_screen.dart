import 'package:flutter/material.dart';
import '../../../../core/widgets/app_avatar.dart';

/// Profile view/edit screen from Settings.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameController = TextEditingController(text: 'Your Name');
  final _usernameController = TextEditingController(text: '@username');
  final _aboutController = TextEditingController(text: 'Available');

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _aboutController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        children: [
          const SizedBox(height: 24),
          Center(
            child: GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Image picker launched (Stub)')),
                );
              },
              child: Stack(
                alignment: Alignment.bottomRight,
                children: [
                  const AppAvatar(name: 'Your Name', radius: 56),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt, size: 20, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          _ProfileField(
            icon: Icons.person_outline,
            label: 'Name',
            controller: _nameController,
          ),
          _ProfileField(
            icon: Icons.alternate_email,
            label: 'Username',
            controller: _usernameController,
          ),
          _ProfileField(
            icon: Icons.info_outline,
            label: 'About',
            controller: _aboutController,
          ),
          const Divider(height: 32),
          ListTile(
            leading: const Icon(Icons.phone_outlined),
            title: const Text('Phone'),
            subtitle: const Text('+91 99999 99999'),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _ProfileField extends StatelessWidget {
  final IconData icon;
  final String label;
  final TextEditingController controller;

  const _ProfileField({required this.icon, required this.label, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: Theme.of(context).textTheme.bodySmall?.color),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelSmall),
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.edit, size: 18, color: Theme.of(context).colorScheme.primary),
        ],
      ),
    );
  }
}
