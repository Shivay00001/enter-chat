/// Chat domain entities mapped to PostgreSQL backend responses.

class Chat {
  final String id;
  final String type; // direct, group, channel, community
  final String? title; // from db: title or directPartnerName
  final String? description;
  final String? avatarUrl; // from db: avatarUrl or directPartnerAvatar
  final String state;
  final MessagePreview? lastMessage;
  final int unreadCount;
  final String updatedAt;
  final String createdAt;

  const Chat({
    required this.id,
    required this.type,
    this.title,
    this.description,
    this.avatarUrl,
    this.state = 'active',
    this.lastMessage,
    this.unreadCount = 0,
    required this.updatedAt,
    required this.createdAt,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    // Handle dynamic title/avatar for direct chats based on postgres query
    final isDirect = json['chatType'] == 'direct';
    final computedTitle = isDirect ? (json['directPartnerName'] as String?) : (json['title'] as String?);
    final computedAvatar = isDirect ? (json['directPartnerAvatar'] as String?) : (json['avatarUrl'] as String?);

    MessagePreview? preview;
    if (json['lastMessageContent'] != null || json['lastMessageType'] != null) {
      preview = MessagePreview(
        id: 'preview', // ID is not returned in the lateral join, but we only need it for display
        senderDisplayName: json['lastMessageSenderName'] as String? ?? '',
        type: json['lastMessageType'] as String? ?? 'text',
        preview: json['lastMessageContent'] as String?,
        createdAt: json['lastMessageAt'] as String? ?? json['updatedAt'] as String,
      );
    }

    return Chat(
      id: json['id'] as String,
      type: json['chatType'] as String? ?? 'group',
      title: computedTitle,
      description: json['description'] as String?,
      avatarUrl: computedAvatar,
      state: json['state'] as String? ?? 'active',
      lastMessage: preview,
      unreadCount: json['unreadCount'] as int? ?? 0,
      updatedAt: json['updatedAt'] as String,
      createdAt: json['createdAt'] as String,
    );
  }
}

class MessagePreview {
  final String id;
  final String? senderId;
  final String senderDisplayName;
  final String type;
  final String? preview;
  final String createdAt;

  const MessagePreview({
    required this.id,
    this.senderId,
    required this.senderDisplayName,
    required this.type,
    this.preview,
    required this.createdAt,
  });
}

class MessageReaction {
  final String emoji;
  final int count;

  const MessageReaction({required this.emoji, required this.count});
}

class Message {
  final String id;
  final String chatId;
  final String senderId;
  final String senderName;
  final String? senderAvatar;
  final String type; // msgType from DB
  final String? body; // content from DB
  final String? mediaUrl;
  final Map<String, dynamic>? mediaMetadata;
  final String? replyToMessageId;
  final String? replyContent;
  final String? replySenderName;
  final String? forwardFromId;
  final String? deletedAt;
  final String createdAt;
  final String? editedAt;
  final List<MessageReaction> reactions;

  const Message({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.senderName,
    this.senderAvatar,
    required this.type,
    this.body,
    this.mediaUrl,
    this.mediaMetadata,
    this.replyToMessageId,
    this.replyContent,
    this.replySenderName,
    this.forwardFromId,
    this.deletedAt,
    required this.createdAt,
    this.editedAt,
    this.reactions = const [],
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    List<MessageReaction> parsedReactions = [];
    if (json['reactions'] != null) {
      final reactionsMap = json['reactions'] as Map<String, dynamic>;
      parsedReactions = reactionsMap.entries
          .map((e) => MessageReaction(emoji: e.key, count: e.value as int))
          .toList();
    }

    return Message(
      id: json['id'] as String,
      chatId: json['chatId'] as String,
      senderId: json['senderId'] as String,
      senderName: json['senderName'] as String? ?? 'Unknown User',
      senderAvatar: json['senderAvatar'] as String?,
      type: json['msgType'] as String? ?? 'text',
      body: json['content'] as String?,
      mediaUrl: json['mediaUrl'] as String?,
      mediaMetadata: json['mediaMetadata'] as Map<String, dynamic>?,
      replyToMessageId: json['replyToId'] as String?,
      replyContent: json['replyContent'] as String?,
      replySenderName: json['replySenderName'] as String?,
      forwardFromId: json['forwardFromId'] as String?,
      deletedAt: json['deletedAt'] as String?,
      createdAt: json['createdAt'] as String,
      editedAt: json['editedAt'] as String?,
      reactions: parsedReactions,
    );
  }

  bool get isDeleted => deletedAt != null;
  bool get isEdited => editedAt != null;

  Message copyWith({
    String? id,
    String? chatId,
    String? senderId,
    String? senderName,
    String? senderAvatar,
    String? type,
    String? body,
    String? mediaUrl,
    Map<String, dynamic>? mediaMetadata,
    String? replyToMessageId,
    String? replyContent,
    String? replySenderName,
    String? forwardFromId,
    String? deletedAt,
    String? createdAt,
    String? editedAt,
    List<MessageReaction>? reactions,
  }) {
    return Message(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      type: type ?? this.type,
      body: body ?? this.body,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      mediaMetadata: mediaMetadata ?? this.mediaMetadata,
      replyToMessageId: replyToMessageId ?? this.replyToMessageId,
      replyContent: replyContent ?? this.replyContent,
      replySenderName: replySenderName ?? this.replySenderName,
      forwardFromId: forwardFromId ?? this.forwardFromId,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      editedAt: editedAt ?? this.editedAt,
      reactions: reactions ?? this.reactions,
    );
  }
}
