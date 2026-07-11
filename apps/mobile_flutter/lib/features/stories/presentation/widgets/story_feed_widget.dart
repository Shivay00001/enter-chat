import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/providers/story_providers.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/app_avatar.dart';
import '../../domain/entities/story.dart';

class StoryFeedWidget extends ConsumerWidget {
  const StoryFeedWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(storyFeedProvider);

    return SizedBox(
      height: 100,
      child: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Failed to load stories', style: TextStyle(color: AppColors.brandDanger))),
        data: (storyGroups) {
          return ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: storyGroups.length + 1, // +1 for "Add Story" button
            itemBuilder: (context, index) {
              if (index == 0) {
                return _buildAddStoryButton(context);
              }
              final group = storyGroups[index - 1];
              return _buildStoryAvatar(context, group);
            },
          );
        },
      ),
    );
  }

  Widget _buildAddStoryButton(BuildContext context) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Story camera/picker launched (Stub)')),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(right: 16.0),
        child: Column(
          children: [
            Stack(
              children: [
                const AppAvatar(name: 'My Status', radius: 28),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.brandPrimary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 2),
                    ),
                    padding: const EdgeInsets.all(2),
                    child: const Icon(Icons.add, size: 16, color: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text('Add Story', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _buildStoryAvatar(BuildContext context, UserStoryGroup group) {
    final hasUnviewed = !group.allViewed;
    final borderColor = hasUnviewed ? AppColors.brandPrimary : Colors.grey.shade400;

    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Opening story viewer for ${group.userName} (Stub)')),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(right: 16.0),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(3), // Thicker ring space
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: hasUnviewed ? AppColors.instaGradient : null,
                color: hasUnviewed ? null : Theme.of(context).dividerColor.withOpacity(0.2),
              ),
              child: Container(
                padding: const EdgeInsets.all(2), // Inner gap to separate ring from avatar
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Theme.of(context).scaffoldBackgroundColor, // Creates the gap
                ),
                child: AppAvatar(
                  name: group.userName,
                  imageUrl: group.userAvatar,
                  radius: 26,
                ),
              ),
            ),
            const SizedBox(height: 6),
            SizedBox(
              width: 64,
              child: Text(
                group.userName,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
