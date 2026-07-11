// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contact_sync_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$contactSyncServiceHash() =>
    r'613663bf890c785d6cd80157a83304c679f7eb0c';

/// See also [contactSyncService].
@ProviderFor(contactSyncService)
final contactSyncServiceProvider =
    AutoDisposeProvider<ContactSyncService>.internal(
  contactSyncService,
  name: r'contactSyncServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$contactSyncServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef ContactSyncServiceRef = AutoDisposeProviderRef<ContactSyncService>;
String _$syncedContactsHash() => r'0e9fd36b77895a7acb4b394d013d90deb3ae0599';

/// See also [syncedContacts].
@ProviderFor(syncedContacts)
final syncedContactsProvider =
    AutoDisposeFutureProvider<List<EnterChatContact>>.internal(
  syncedContacts,
  name: r'syncedContactsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$syncedContactsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

typedef SyncedContactsRef
    = AutoDisposeFutureProviderRef<List<EnterChatContact>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member
