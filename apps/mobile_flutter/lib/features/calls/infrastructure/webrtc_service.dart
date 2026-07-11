import 'dart:async';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/websocket_manager.dart';
import '../../realtime/application/providers/ws_providers.dart';

class WebRTCService {
  final WebSocketManager _wsManager;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  MediaStream? _remoteStream;

  final _remoteStreamController = StreamController<MediaStream?>.broadcast();
  Stream<MediaStream?> get remoteStream => _remoteStreamController.stream;

  StreamSubscription<WsEvent>? _signalingSub;
  String? _currentCallId;

  WebRTCService(this._wsManager) {
    _listenForSignaling();
  }

  void _listenForSignaling() {
    _signalingSub = _wsManager.events
        .where((e) => e.type.startsWith('call.'))
        .listen((event) async {
      final payload = event.payload;
      switch (event.type) {
        case 'call.offer':
          await _handleOffer(payload);
          break;
        case 'call.answer':
          await _handleAnswer(payload);
          break;
        case 'call.ice_candidate':
          await _handleIceCandidate(payload);
          break;
        case 'call.end':
          endCall();
          break;
      }
    });
  }

  Future<void> startCall(String targetUserId, {bool video = true}) async {
    _currentCallId = DateTime.now().millisecondsSinceEpoch.toString();
    await _initPeerConnection();
    await _getUserMedia(video: video);

    final offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);

    _wsManager.send('call.offer', {
      'targetUserId': targetUserId,
      'callId': _currentCallId,
      'sdp': offer.toMap(),
    });
  }

  Future<void> _handleOffer(Map<String, dynamic> payload) async {
    _currentCallId = payload['callId'];
    await _initPeerConnection();
    await _getUserMedia(video: true); // or based on offer type

    final offerMap = Map<String, dynamic>.from(payload['sdp']);
    await _peerConnection!.setRemoteDescription(
      RTCSessionDescription(offerMap['sdp'], offerMap['type']),
    );

    final answer = await _peerConnection!.createAnswer();
    await _peerConnection!.setLocalDescription(answer);

    _wsManager.send('call.answer', {
      'targetUserId': payload['senderId'],
      'callId': _currentCallId,
      'sdp': answer.toMap(),
    });
  }

  Future<void> _handleAnswer(Map<String, dynamic> payload) async {
    final answerMap = Map<String, dynamic>.from(payload['sdp']);
    await _peerConnection!.setRemoteDescription(
      RTCSessionDescription(answerMap['sdp'], answerMap['type']),
    );
  }

  Future<void> _handleIceCandidate(Map<String, dynamic> payload) async {
    if (_peerConnection == null) return;
    final candidateMap = Map<String, dynamic>.from(payload['candidate']);
    await _peerConnection!.addCandidate(
      RTCIceCandidate(
        candidateMap['candidate'],
        candidateMap['sdpMid'],
        candidateMap['sdpMLineIndex'],
      ),
    );
  }

  Future<void> _initPeerConnection() async {
    final config = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
      ]
    };
    _peerConnection = await createPeerConnection(config);

    _peerConnection!.onIceCandidate = (candidate) {
      if (_currentCallId == null) return;
      _wsManager.send('call.ice_candidate', {
        // Need targetUserId. Simplification: send via WS and backend infers or we store it.
        // For now, assuming backend routes by call session or we inject targetUserId.
        'callId': _currentCallId,
        'candidate': candidate.toMap(),
      });
    };

    _peerConnection!.onAddStream = (stream) {
      _remoteStream = stream;
      _remoteStreamController.add(stream);
    };
  }

  Future<void> _getUserMedia({required bool video}) async {
    final mediaConstraints = {
      'audio': true,
      'video': video ? {'facingMode': 'user'} : false,
    };

    _localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    _peerConnection?.addStream(_localStream!);
  }

  void endCall() {
    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream?.dispose();
    _peerConnection?.close();
    _peerConnection = null;
    _remoteStreamController.add(null);
    _currentCallId = null;
  }

  void dispose() {
    _signalingSub?.cancel();
    endCall();
    _remoteStreamController.close();
  }
}

final webrtcServiceProvider = Provider<WebRTCService>((ref) {
  final wsManager = ref.read(wsManagerProvider);
  final service = WebRTCService(wsManager);
  ref.onDispose(() => service.dispose());
  return service;
});
