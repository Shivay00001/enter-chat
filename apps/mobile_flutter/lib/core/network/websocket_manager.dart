import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';
import '../storage/secure_storage.dart';
import 'api_config.dart';

/// WebSocket connection states.
enum WsConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

/// A WebSocket event received from the server.
class WsEvent {
  final String type;
  final String? requestId;
  final Map<String, dynamic> payload;
  final String? serverTime;

  WsEvent({
    required this.type,
    this.requestId,
    required this.payload,
    this.serverTime,
  });

  factory WsEvent.fromJson(Map<String, dynamic> json) {
    return WsEvent(
      type: json['type'] as String? ?? 'unknown',
      requestId: json['requestId'] as String?,
      payload: Map<String, dynamic>.from(json['payload'] as Map? ?? {}),
      serverTime: json['serverTime'] as String?,
    );
  }
}

/// Manages the WebSocket connection to the EnterChat server.
///
/// Features:
/// - Auto-connect with JWT auth token
/// - Auto-reconnect with exponential backoff
/// - Heartbeat (ping/pong)
/// - Event stream for UI consumption (Riverpod-compatible)
/// - Send messages with request ID tracking
///
/// Inspired by: WhatsApp (reliable delivery), Telegram (multi-device sync),
/// Discord (persistent connection with heartbeat).
class WebSocketManager {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;

  final _eventController = StreamController<WsEvent>.broadcast();
  final _connectionStateController = StreamController<WsConnectionState>.broadcast();

  WsConnectionState _state = WsConnectionState.disconnected;
  int _reconnectAttempts = 0;
  static const _maxReconnectAttempts = 15;
  static const _heartbeatInterval = Duration(seconds: 25);
  static const _uuid = Uuid();

  /// Stream of all WebSocket events from the server.
  Stream<WsEvent> get events => _eventController.stream;

  /// Stream of connection state changes.
  Stream<WsConnectionState> get connectionState => _connectionStateController.stream;

  /// Current connection state.
  WsConnectionState get currentState => _state;

  /// Whether the WebSocket is currently connected.
  bool get isConnected => _state == WsConnectionState.connected;

  /// Connect to the WebSocket server.
  /// Reads the JWT token from secure storage and appends it as a query param.
  Future<void> connect() async {
    if (_state == WsConnectionState.connecting || _state == WsConnectionState.connected) {
      return;
    }

    _setState(WsConnectionState.connecting);

    try {
      final secureStorage = SecureStorage();
      final token = await secureStorage.getAccessToken();

      if (token == null) {
        _setState(WsConnectionState.disconnected);
        return;
      }

      final wsUri = Uri.parse('${ApiConfig.wsUrl}?token=$token');
      _channel = WebSocketChannel.connect(wsUri);

      // Wait for connection to be established
      await _channel!.ready;

      _setState(WsConnectionState.connected);
      _reconnectAttempts = 0;

      // Listen for incoming messages
      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );

      // Start heartbeat
      _startHeartbeat();

    } catch (e) {
      _setState(WsConnectionState.disconnected);
      _scheduleReconnect();
    }
  }

  /// Disconnect from the WebSocket server.
  Future<void> disconnect() async {
    _stopHeartbeat();
    _cancelReconnect();
    _subscription?.cancel();
    _subscription = null;

    if (_channel != null) {
      await _channel!.sink.close(1000, 'Client disconnect');
      _channel = null;
    }

    _setState(WsConnectionState.disconnected);
    _reconnectAttempts = 0;
  }

  /// Send a typed message to the server.
  /// Returns the requestId for tracking acknowledgements.
  String send(String type, Map<String, dynamic> payload) {
    final requestId = _uuid.v4();
    final message = jsonEncode({
      'type': type,
      'requestId': requestId,
      'payload': payload,
    });

    if (_channel != null && _state == WsConnectionState.connected) {
      _channel!.sink.add(message);
    }

    return requestId;
  }

  /// Send a raw message (pre-encoded JSON string).
  void sendRaw(String jsonMessage) {
    if (_channel != null && _state == WsConnectionState.connected) {
      _channel!.sink.add(jsonMessage);
    }
  }

  // --- Convenience methods matching the backend protocol ---

  /// Send a chat message via WebSocket (real-time delivery).
  String sendMessage(String chatId, String content, {String msgType = 'text', String? replyToId}) {
    return send('message.send', {
      'chatId': chatId,
      'content': content,
      'msgType': msgType,
      if (replyToId != null) 'replyToId': replyToId,
    });
  }

  /// Send typing indicator.
  String sendTyping(String chatId, {bool isTyping = true}) {
    return send('message.typing', {
      'chatId': chatId,
      'isTyping': isTyping,
    });
  }

  /// Send read receipt.
  String sendReadReceipt(String chatId) {
    return send('message.read', {
      'chatId': chatId,
    });
  }

  /// Send a ping to keep the connection alive.
  void ping() {
    send('ping', {});
  }

  // --- Internal handlers ---

  void _onMessage(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      final event = WsEvent.fromJson(json);

      // Handle pong internally (heartbeat response)
      if (event.type == 'pong') {
        return;
      }

      _eventController.add(event);
    } catch (e) {
      // Malformed message — ignore
    }
  }

  void _onError(Object error) {
    _setState(WsConnectionState.disconnected);
    _stopHeartbeat();
    _scheduleReconnect();
  }

  void _onDone() {
    _setState(WsConnectionState.disconnected);
    _stopHeartbeat();
    _scheduleReconnect();
  }

  // --- Heartbeat ---

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) {
      if (_state == WsConnectionState.connected) {
        ping();
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  // --- Reconnection with exponential backoff ---

  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      _setState(WsConnectionState.disconnected);
      return;
    }

    _cancelReconnect();
    _setState(WsConnectionState.reconnecting);

    // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
    final delay = Duration(
      milliseconds: (1000 * (1 << _reconnectAttempts)).clamp(1000, 30000),
    );
    _reconnectAttempts++;

    _reconnectTimer = Timer(delay, () {
      connect();
    });
  }

  void _cancelReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  // --- State management ---

  void _setState(WsConnectionState newState) {
    if (_state != newState) {
      _state = newState;
      _connectionStateController.add(newState);
    }
  }

  /// Dispose all resources.
  void dispose() {
    _stopHeartbeat();
    _cancelReconnect();
    _subscription?.cancel();
    _channel?.sink.close(1000, 'Disposed');
    _eventController.close();
    _connectionStateController.close();
  }
}
