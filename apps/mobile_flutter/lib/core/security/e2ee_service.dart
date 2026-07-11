import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/security/e2e_crypto_engine.dart';

/// Provider for the E2EE key exchange service.
final e2eeServiceProvider = Provider<E2EEService>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return E2EEService(apiClient: apiClient);
});

/// Service that orchestrates E2EE key exchange between Flutter client and backend.
///
/// Lifecycle:
/// 1. On login: initialize crypto engine + upload key bundle
/// 2. Before first message to new recipient: fetch their bundle + establish session
/// 3. Periodically: check key status + replenish OPKs
class E2EEService {
  final ApiClient _apiClient;
  final E2ECryptoEngine _crypto = E2ECryptoEngine();

  E2EEService({required ApiClient apiClient}) : _apiClient = apiClient;

  /// Initialize E2EE: generate keys and upload bundle to server.
  Future<void> initialize() async {
    await _crypto.initialize();
    await uploadKeyBundle();
    debugPrint('[E2EE Service] Initialized and key bundle uploaded');
  }

  /// Upload key bundle to the server.
  Future<void> uploadKeyBundle() async {
    final bundle = _crypto.getKeyBundle();
    await _apiClient.post(ApiConfig.keyBundleUpload, data: bundle);
    debugPrint('[E2EE Service] Key bundle uploaded');
  }

  /// Fetch recipient's key bundle and establish an E2EE session.
  Future<void> establishSessionWithUser(String recipientUserId) async {
    if (_crypto.hasSession(recipientUserId)) {
      debugPrint('[E2EE Service] Session already exists for $recipientUserId');
      return;
    }

    final response = await _apiClient.get(ApiConfig.keyBundleFetch(recipientUserId));
    final data = response.data as Map<String, dynamic>;
    final devices = data['devices'] as List<dynamic>;

    if (devices.isEmpty) {
      debugPrint('[E2EE Service] No key bundles for $recipientUserId');
      return;
    }

    // Establish session with the first device (primary)
    final deviceBundle = devices[0] as Map<String, dynamic>;
    await _crypto.establishSession(recipientUserId, deviceBundle);
    debugPrint('[E2EE Service] Session established with $recipientUserId');
  }

  /// Encrypt a message for a recipient.
  Future<String> encryptMessage(String recipientId, String plaintext) async {
    return _crypto.encryptMessage(recipientId, plaintext);
  }

  /// Decrypt a message from a sender.
  Future<String> decryptMessage(String senderId, String encryptedPayload) async {
    return _crypto.decryptMessage(senderId, encryptedPayload);
  }

  /// Check key status and replenish OPKs if needed.
  Future<void> checkAndReplenishKeys() async {
    try {
      final response = await _apiClient.get('${ApiConfig.keyBundleUpload}/../keys/status');
      final data = response.data as Map<String, dynamic>;

      if (data['needsReplenishment'] == true) {
        debugPrint('[E2EE Service] OPKs running low — replenishing');
        await uploadKeyBundle();
      }
    } catch (e) {
      debugPrint('[E2EE Service] Key status check failed: $e');
    }
  }

  /// Get the local identity public key.
  String get myPublicKey => _crypto.myPublicKey;

  /// Check if a session exists with a user.
  bool hasSession(String userId) => _crypto.hasSession(userId);
}
