import '../entities/story.dart';

abstract class StoryRepository {
  Future<List<UserStoryGroup>> getStoryFeed();
  Future<Story> createStory({
    required String mediaUrl,
    required String mediaType,
    String? caption,
    String? backgroundColor,
    int? duration,
  });
  Future<void> viewStory(String storyId);
  Future<void> reactToStory(String storyId, String emoji);
  Future<void> deleteStory(String storyId);
}
