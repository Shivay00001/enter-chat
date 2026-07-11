import '../../domain/entities/story.dart';
import '../../domain/repositories/story_repository.dart';
import '../../../../core/network/api_client.dart';

class ApiStoryRepository implements StoryRepository {
  final ApiClient _apiClient;

  ApiStoryRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<List<UserStoryGroup>> getStoryFeed() async {
    // Note: ensure your backend has a /v1/stories endpoint that maps to PostgresStoryRepository.getStoryFeed
    final response = await _apiClient.get('/v1/stories');
    final data = response.data as Map<String, dynamic>;
    return (data['data'] as List).map((j) => UserStoryGroup.fromJson(j as Map<String, dynamic>)).toList();
  }

  @override
  Future<Story> createStory({
    required String mediaUrl,
    required String mediaType,
    String? caption,
    String? backgroundColor,
    int? duration,
  }) async {
    final response = await _apiClient.post('/v1/stories', data: {
      'mediaUrl': mediaUrl,
      'mediaType': mediaType,
      'caption': caption,
      'backgroundColor': backgroundColor,
      'duration': duration,
    });
    return Story.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> viewStory(String storyId) async {
    await _apiClient.post('/v1/stories/$storyId/views');
  }

  @override
  Future<void> reactToStory(String storyId, String emoji) async {
    await _apiClient.post('/v1/stories/$storyId/reactions', data: {'emoji': emoji});
  }

  @override
  Future<void> deleteStory(String storyId) async {
    await _apiClient.delete('/v1/stories/$storyId');
  }
}
