import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/router/route_names.dart';
import '../../../../core/widgets/app_avatar.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';

/// Profile setup screen shown after first-time registration.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set up your profile')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              GestureDetector(
                onTap: () async {
                  // Production would use image_picker package:
                  // final ImagePicker picker = ImagePicker();
                  // final XFile? image = await picker.pickImage(source: ImageSource.gallery);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Image picker launched (Stub)')),
                  );
                },
                child: Stack(
                  alignment: Alignment.bottomRight,
                  children: [
                    AppAvatar(name: _nameController.text.isEmpty ? 'U' : _nameController.text, radius: 48),
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt, size: 16, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(hintText: 'Your name', prefixIcon: Icon(Icons.person_outline)),
                textCapitalization: TextCapitalization.words,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _usernameController,
                decoration: const InputDecoration(hintText: 'Username (optional)', prefixIcon: Icon(Icons.alternate_email)),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_nameController.text.trim().isNotEmpty && !_isLoading) ? _onSave : null,
                  child: _isLoading 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onSave() async {
    setState(() => _isLoading = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      
      // Call profile update API
      await apiClient.patch(
        ApiConfig.usersMeProfile,
        data: {
          'displayName': _nameController.text.trim(),
          if (_usernameController.text.trim().isNotEmpty) 'username': _usernameController.text.trim(),
        },
      );
      
      if (mounted) {
        context.go(RouteNames.chats);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save profile: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}
