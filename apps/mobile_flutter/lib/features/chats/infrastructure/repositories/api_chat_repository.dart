import '../../../../core/security/e2e_crypto_engine.dart';
import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';
import 'package:uuid/uuid.dart';

/// API-backed chat repository — connects to the real backend.
class ApiChatRepository implements ChatRepository {
  final ApiClient _apiClient;
  final _uuid = const Uuid();
  final _crypto = E2ECryptoEngine();

  ApiChatRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<PaginatedResult<Chat>> getChats({String? cursor, int limit = 50}) async {
    final queryParams = <String, dynamic>{'limit': limit};
    if (cursor != null) queryParams['cursor'] = cursor;

    final response = await _apiClient.get(ApiConfig.chats, queryParameters: queryParams);
    final data = response.data as Map<String, dynamic>;

    return PaginatedResult(
      data: (data['data'] as List).map((j) => Chat.fromJson(j as Map<String, dynamic>)).toList(),
      cursor: data['cursor'] as String?,
      hasMore: data['hasMore'] as bool? ?? false,
    );
  }

  @override
  Future<Chat> getChat(String chatId) async {
    final response = await _apiClient.get('${ApiConfig.chats}/$chatId');
    return Chat.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<Chat> createDirectChat(String recipientUserId) async {
    final response = await _apiClient.post(
      ApiConfig.chatsDirect,
      data: {'recipientUserId': recipientUserId},
    );
    return Chat.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<Chat> createGroup({
    required String title,
    String? description,
    required List<String> memberUserIds,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.chatsGroup,
      data: {
        'title': title,
        'description': description,
        'memberUserIds': memberUserIds,
      },
    );
    return Chat.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<PaginatedResult<Message>> getMessages(String chatId, {String? before, int limit = 50}) async {
    final queryParams = <String, dynamic>{'limit': limit};
    if (before != null) queryParams['before'] = before;

    final response = await _apiClient.get(
      ApiConfig.chatMessages(chatId),
      queryParameters: queryParams,
    );
    final data = response.data as Map<String, dynamic>;

    final rawMessages = (data['messages'] as List).map((j) => Message.fromJson(j as Map<String, dynamic>)).toList();
    
    // Decrypt all message bodies locally
    final decryptedMessages = await Future.wait(rawMessages.map((msg) async {
      if (msg.body != null && msg.type == 'text') {
        final decryptedBody = await _crypto.decryptMessage(msg.senderId, msg.body!);
        return msg.copyWith(body: decryptedBody);
      }
      return msg;
    }));

    return PaginatedResult(
      data: decryptedMessages,
      cursor: data['cursor'] as String?,
      hasMore: data['hasMore'] as bool? ?? false,
    );
  }

  @override
  Future<Message> sendMessage({
    required String chatId,
    required String msgType,
    String? content,
    String? replyToId,
    String? forwardFromId,
    String? mediaUrl,
    Map<String, dynamic>? mediaMetadata,
  }) async {
    final clientMessageId = _uuid.v4();
    
    // Apply E2EE Encryption locally before sending over network
    String? payload = content;
    if (msgType == 'text' && content != null) {
      payload = await _crypto.encryptMessage(chatId, content);
    }

    final response = await _apiClient.post(
      ApiConfig.chatMessages(chatId),
      data: {
        'clientMessageId': clientMessageId,
        'msgType': msgType,
        'content': payload,
        if (replyToId != null) 'replyToId': replyToId,
        if (forwardFromId != null) 'forwardFromId': forwardFromId,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (mediaMetadata != null) 'mediaMetadata': mediaMetadata,
      },
    );
    final msg = Message.fromJson(response.data as Map<String, dynamic>);
    
    // Decrypt the echo back so UI sees plaintext
    if (msg.body != null && msg.type == 'text') {
      final decryptedBody = await _crypto.decryptMessage(msg.senderId, msg.body!);
      return msg.copyWith(body: decryptedBody);
    }
    return msg;
  }

  @override
  Future<Message> editMessage(String messageId, String newContent) async {
    final response = await _apiClient.patch(
      ApiConfig.message(messageId),
      data: {'content': newContent},
    );
    return Message.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> deleteMessage(String messageId, {bool everyone = false}) async {
    await _apiClient.delete(
      ApiConfig.message(messageId),
      queryParameters: {'everyone': everyone.toString()},
    );
  }

  @override
  Future<void> reactToMessage(String messageId, String emoji) async {
    await _apiClient.post(
      '${ApiConfig.message(messageId)}/reactions',
      data: {'emoji': emoji},
    );
  }

  @override
  Future<void> markAsRead(String chatId) async {
    await _apiClient.post('${ApiConfig.chats}/$chatId/read');
  }
}
