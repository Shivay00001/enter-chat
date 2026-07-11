import '../entities/chat.dart';

/// Chat repository port — swappable between mock and API implementations.
abstract class ChatRepository {
  /// List user's chats with cursor pagination.
  Future<PaginatedResult<Chat>> getChats({String? cursor, int limit = 50});

  /// Get a single chat by ID.
  Future<Chat> getChat(String chatId);

  /// Create a direct (1:1) chat.
  Future<Chat> createDirectChat(String recipientUserId);

  /// Create a group chat.
  Future<Chat> createGroup({
    required String title,
    String? description,
    required List<String> memberUserIds,
  });

  /// Get messages for a chat with cursor pagination.
  Future<PaginatedResult<Message>> getMessages(String chatId, {String? before, int limit = 50});

  /// Send a message.
  Future<Message> sendMessage({
    required String chatId,
    required String msgType,
    String? content,
    String? replyToId,
    String? forwardFromId,
    String? mediaUrl,
    Map<String, dynamic>? mediaMetadata,
  });

  /// Edit a message.
  Future<Message> editMessage(String messageId, String newContent);

  /// Delete a message.
  Future<void> deleteMessage(String messageId, {bool everyone = false});

  /// React to a message
  Future<void> reactToMessage(String messageId, String emoji);

  /// Mark all messages in a chat as read
  Future<void> markAsRead(String chatId);
}

/// Generic paginated result.
class PaginatedResult<T> {
  final List<T> data;
  final String? cursor;
  final bool hasMore;

  const PaginatedResult({
    required this.data,
    this.cursor,
    this.hasMore = false,
  });
}
