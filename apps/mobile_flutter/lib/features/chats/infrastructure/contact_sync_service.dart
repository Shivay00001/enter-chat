import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/network/api_client.dart';

part 'contact_sync_service.g.dart';

class EnterChatContact {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? statusText;
  final String phoneHash;

  EnterChatContact({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.statusText,
    required this.phoneHash,
  });

  factory EnterChatContact.fromJson(Map<String, dynamic> json) {
    return EnterChatContact(
      id: json['id'] as String,
      username: json['username'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      statusText: json['statusText'] as String?,
      phoneHash: json['phoneHash'] as String,
    );
  }
}

class ContactSyncService {
  final ApiClient _apiClient;

  ContactSyncService(this._apiClient);

  Future<List<EnterChatContact>> syncContacts() async {
    // 1. Request permission
    if (!await FlutterContacts.requestPermission(readonly: true)) {
      throw Exception('Contact permission denied');
    }

    // 2. Fetch contacts (only phones)
    final contacts = await FlutterContacts.getContacts(withProperties: true);
    final phoneHashes = <String>[];

    // 3. Hash phone numbers
    for (final contact in contacts) {
      for (final phone in contact.phones) {
        final normalized = phone.normalizedNumber;
        if (normalized.isNotEmpty) {
          final bytes = utf8.encode(normalized);
          final digest = sha256.convert(bytes);
          final base64Hash = base64.encode(digest.bytes);
          phoneHashes.add(base64Hash);
        }
      }
    }

    if (phoneHashes.isEmpty) {
      return [];
    }

    // 4. Send to backend
    final response = await _apiClient.post(
      '/v1/users/sync-contacts',
      data: {'phoneHashes': phoneHashes},
    );

    final matches = response.data['matches'] as List;
    return matches.map((m) => EnterChatContact.fromJson(m)).toList();
  }
}

@riverpod
ContactSyncService contactSyncService(ContactSyncServiceRef ref) {
  return ContactSyncService(ref.watch(apiClientProvider));
}

@riverpod
Future<List<EnterChatContact>> syncedContacts(SyncedContactsRef ref) {
  final service = ref.watch(contactSyncServiceProvider);
  return service.syncContacts();
}
