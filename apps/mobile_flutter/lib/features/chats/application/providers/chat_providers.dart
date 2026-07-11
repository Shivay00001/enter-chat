import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../infrastructure/repositories/api_chat_repository.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/supabase_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

// --- Repository provider ---
final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return ApiChatRepository(apiClient: apiClient);
});

// --- Chat list state with real-time updates ---

final chatListProvider = StateNotifierProvider<ChatListNotifier, AsyncValue<List<Chat>>>((ref) {
  final repo = ref.read(chatRepositoryProvider);
  final client = ref.read(supabaseClientProvider);
  return ChatListNotifier(repo, client);
});

class ChatListNotifier extends StateNotifier<AsyncValue<List<Chat>>> {
  final ChatRepository _repo;
  final supabase.SupabaseClient _supabase;
  supabase.RealtimeChannel? _channel;

  ChatListNotifier(this._repo, this._supabase) : super(const AsyncValue.loading()) {
    loadChats();
    _listenForNewMessages();
  }

  void _listenForNewMessages() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    // Listen to changes on the messages table where the user is involved
    // In a real app, this might be a Postgres trigger or listening to user's personal channel
    _channel = _supabase.channel('public:messages')
      .onPostgresChanges(
        event: supabase.PostgresChangeEvent.insert,
        schema: 'public',
        table: 'messages',
        callback: (payload) {
          refresh();
        },
      )
      .subscribe();
  }

  Future<void> loadChats() async {
    state = const AsyncValue.loading();
    try {
      final result = await _repo.getChats();
      state = AsyncValue.data(result.data);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() async {
    try {
      final result = await _repo.getChats();
      state = AsyncValue.data(result.data);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}

// --- Messages state with real-time WebSocket integration ---

final messagesProvider = StateNotifierProvider.family<MessagesNotifier, AsyncValue<List<Message>>, String>(
  (ref, chatId) {
    final repo = ref.read(chatRepositoryProvider);
    final client = ref.read(supabaseClientProvider);
    return MessagesNotifier(repo, client, chatId);
  },
);

class MessagesNotifier extends StateNotifier<AsyncValue<List<Message>>> {
  final ChatRepository _repo;
  final supabase.SupabaseClient _supabase;
  final String chatId;
  supabase.RealtimeChannel? _channel;

  MessagesNotifier(this._repo, this._supabase, this.chatId)
      : super(const AsyncValue.loading()) {
    loadMessages();
    _listenForRealTimeUpdates();
  }

  void _listenForRealTimeUpdates() {
    // Listen to Supabase Postgres CDC for messages in this chat
    _channel = _supabase.channel('public:messages:chat_id=eq.$chatId')
      .onPostgresChanges(
        event: supabase.PostgresChangeEvent.all,
        schema: 'public',
        table: 'messages',
        filter: supabase.PostgresChangeFilter(
          type: supabase.PostgresChangeFilterType.eq,
          column: 'chat_id',
          value: chatId,
        ),
        callback: (payload) {
          // If insert, append. If update/delete, reload.
          if (payload.eventType == supabase.PostgresChangeEvent.insert) {
             final row = payload.newRecord;
             final newMessage = Message(
               id: row['id'] as String,
               chatId: row['chat_id'] as String,
               senderId: row['sender_id'] as String,
               senderName: '', // Would need join or fetch
               body: row['content'] as String? ?? '',
               type: row['msgType'] as String? ?? 'text',
               createdAt: row['created_at'] as String,
               replyToMessageId: row['reply_to_id'] as String?,
               mediaUrl: row['media_url'] as String?,
             );

             final current = state.value ?? [];
             if (!current.any((m) => m.id == newMessage.id)) {
               state = AsyncValue.data([...current, newMessage]);
             }
          } else {
             loadMessages();
          }
        },
      )
      .subscribe();
  }

  Future<void> loadMessages() async {
    state = const AsyncValue.loading();
    try {
      final result = await _repo.getMessages(chatId);
      state = AsyncValue.data(result.data);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Optimistic send — add message immediately, then persist.
  Future<void> sendMessage({
    required String msgType,
    String? content,
    String? replyToId,
    String? forwardFromId,
    String? mediaUrl,
    Map<String, dynamic>? mediaMetadata,
  }) async {
    try {
      // With Supabase, we rely purely on the HTTP API to persist the message.
      // The Postgres trigger/CDC will notify the other clients.

      // Persist via HTTP for reliability
      final message = await _repo.sendMessage(
        chatId: chatId,
        msgType: msgType,
        content: content,
        replyToId: replyToId,
        forwardFromId: forwardFromId,
        mediaUrl: mediaUrl,
        mediaMetadata: mediaMetadata,
      );
      final current = state.value ?? [];
      // Add if not already added by WS listener
      if (!current.any((m) => m.id == message.id)) {
        state = AsyncValue.data([...current, message]);
      }
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteMessage(String messageId, {bool everyone = false}) async {
    try {
      await _repo.deleteMessage(messageId, everyone: everyone);
      loadMessages();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> editMessage(String messageId, String newContent) async {
    try {
      await _repo.editMessage(messageId, newContent);
      loadMessages();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> reactToMessage(String messageId, String emoji) async {
    try {
      await _repo.reactToMessage(messageId, emoji);
      loadMessages();
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Mark messages as read when the user views the chat
  void markAsRead() async {
    try {
      await _repo.markAsRead(chatId);
    } catch (e) {
      // Silently fail read receipts in background
    }
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}

// --- Typing Status State ---

final typingProvider = StateNotifierProvider.family<TypingNotifier, Set<String>, String>((ref, chatId) {
  final client = ref.read(supabaseClientProvider);
  return TypingNotifier(client, chatId);
});

class TypingNotifier extends StateNotifier<Set<String>> {
  final supabase.SupabaseClient _supabase;
  final String chatId;
  supabase.RealtimeChannel? _channel;

  TypingNotifier(this._supabase, this.chatId) : super({}) {
    _listenForTyping();
  }

  void _listenForTyping() {
    _channel = _supabase.channel('typing:$chatId')
      .onBroadcast(
        event: 'typing_status',
        callback: (payload) {
          final userId = payload['user_id'] as String?;
          final isTyping = payload['is_typing'] as bool? ?? false;
          
          if (userId == null) return;
          
          if (isTyping) {
            state = {...state, userId};
          } else {
            final newState = {...state};
            newState.remove(userId);
            state = newState;
          }
        },
      )
      .subscribe();
  }

  void setTyping(bool isTyping) {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    
    _channel?.sendBroadcastMessage(
      event: 'typing_status',
      payload: {
        'user_id': userId,
        'is_typing': isTyping,
      },
    );
  }

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}
