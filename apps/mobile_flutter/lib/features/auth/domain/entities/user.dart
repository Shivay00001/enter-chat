/// Auth domain entities used across the auth feature.

class User {
  final String id;
  final String? username;
  final String displayName;
  final String? avatarUrl;
  final String? statusText;
  final String accountState;

  const User({
    required this.id,
    this.username,
    required this.displayName,
    this.avatarUrl,
    this.statusText,
    this.accountState = 'active',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String?,
      displayName: json['displayName'] as String? ?? 'User',
      avatarUrl: json['avatarUrl'] as String?,
      statusText: json['statusText'] as String?,
      accountState: json['accountState'] as String? ?? 'active',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'displayName': displayName,
    'avatarUrl': avatarUrl,
    'statusText': statusText,
    'accountState': accountState,
  };

  User copyWith({
    String? username,
    String? displayName,
    String? avatarUrl,
    String? statusText,
  }) {
    return User(
      id: id,
      username: username ?? this.username,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      statusText: statusText ?? this.statusText,
      accountState: accountState,
    );
  }
}

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final User user;

  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as int,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}
