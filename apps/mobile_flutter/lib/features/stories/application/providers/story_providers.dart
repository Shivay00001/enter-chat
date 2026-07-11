import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/story.dart';
import '../../domain/repositories/story_repository.dart';
import '../../infrastructure/repositories/api_story_repository.dart';
import '../../../../core/network/api_client.dart';

final storyRepositoryProvider = Provider<StoryRepository>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return ApiStoryRepository(apiClient: apiClient);
});

final storyFeedProvider = StateNotifierProvider<StoryFeedNotifier, AsyncValue<List<UserStoryGroup>>>((ref) {
  final repo = ref.read(storyRepositoryProvider);
  return StoryFeedNotifier(repo);
});

class StoryFeedNotifier extends StateNotifier<AsyncValue<List<UserStoryGroup>>> {
  final StoryRepository _repo;

  StoryFeedNotifier(this._repo) : super(const AsyncValue.loading()) {
    loadFeed();
  }

  Future<void> loadFeed() async {
    state = const AsyncValue.loading();
    try {
      final feed = await _repo.getStoryFeed();
      state = AsyncValue.data(feed);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() async {
    try {
      final feed = await _repo.getStoryFeed();
      state = AsyncValue.data(feed);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
