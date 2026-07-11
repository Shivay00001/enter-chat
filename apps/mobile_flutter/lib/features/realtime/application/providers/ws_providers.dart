import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/websocket_manager.dart';

/// WebSocket connection state provider.
final wsConnectionStateProvider = StreamProvider<WsConnectionState>((ref) {
  final manager = ref.watch(wsManagerProvider);
  return manager.connectionState;
});

/// WebSocket event stream provider.
final wsEventStreamProvider = StreamProvider<WsEvent>((ref) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events;
});

/// Singleton WebSocket manager provider.
final wsManagerProvider = Provider<WebSocketManager>((ref) {
  final manager = WebSocketManager();
  ref.onDispose(() => manager.dispose());
  return manager;
});

/// Provider to filter events by type.
final wsEventsByTypeProvider = StreamProvider.family<WsEvent, String>((ref, eventType) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events.where((e) => e.type == eventType);
});

/// New message events — for real-time chat updates.
final newMessageEventsProvider = StreamProvider<WsEvent>((ref) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events.where((e) => e.type == 'message.new');
});

/// Typing indicator events.
final typingEventsProvider = StreamProvider.family<WsEvent, String>((ref, chatId) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events
      .where((e) => (e.type == 'typing.start' || e.type == 'typing.stop') && e.payload['chatId'] == chatId);
});

/// Presence update events.
final presenceEventsProvider = StreamProvider<WsEvent>((ref) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events.where((e) => e.type == 'presence.update');
});

/// Read receipt events.
final readReceiptEventsProvider = StreamProvider<WsEvent>((ref) {
  final manager = ref.watch(wsManagerProvider);
  return manager.events.where((e) => e.type == 'message.read' || e.type == 'message.delivered');
});
