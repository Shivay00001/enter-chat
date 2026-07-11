class Story {
  final String id;
  final String userId;
  final String? mediaUrl;
  final String mediaType;
  final String? caption;
  final String? backgroundColor;
  final int? duration;
  final String createdAt;
  final String expiresAt;
  final String userName;
  final String? userAvatar;
  final bool viewed;
  final int? viewCount;

  const Story({
    required this.id,
    required this.userId,
    this.mediaUrl,
    required this.mediaType,
    this.caption,
    this.backgroundColor,
    this.duration,
    required this.createdAt,
    required this.expiresAt,
    required this.userName,
    this.userAvatar,
    required this.viewed,
    this.viewCount,
  });

  factory Story.fromJson(Map<String, dynamic> json) {
    return Story(
      id: json['id'] as String,
      userId: json['userId'] as String,
      mediaUrl: json['mediaUrl'] as String?,
      mediaType: json['mediaType'] as String? ?? 'image',
      caption: json['caption'] as String?,
      backgroundColor: json['backgroundColor'] as String?,
      duration: json['duration'] as int?,
      createdAt: json['createdAt'] as String,
      expiresAt: json['expiresAt'] as String,
      userName: json['userName'] as String,
      userAvatar: json['userAvatar'] as String?,
      viewed: json['viewed'] as bool? ?? false,
      viewCount: json['viewCount'] as int?,
    );
  }
}

class UserStoryGroup {
  final String userId;
  final String userName;
  final String? userAvatar;
  final List<Story> stories;
  final bool allViewed;

  const UserStoryGroup({
    required this.userId,
    required this.userName,
    this.userAvatar,
    required this.stories,
  }) : allViewed = stories.length > 0; // Will be properly computed in fromJson

  factory UserStoryGroup.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>;
    final storiesList = (json['stories'] as List)
        .map((e) => Story.fromJson(e as Map<String, dynamic>))
        .toList();
    
    return UserStoryGroup(
      userId: user['id'] as String,
      userName: user['name'] as String,
      userAvatar: user['avatar'] as String?,
      stories: storiesList,
    );
  }
}
