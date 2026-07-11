/// API configuration.
/// All values are configurable — no hardcoded URLs or secrets.
class ApiConfig {
  /// Base URL for REST API.
  /// Default points to Android emulator's host machine.
  /// Override via environment or app config.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// WebSocket URL.
  static const String wsUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://10.0.2.2:3001',
  );

  /// API version prefix.
  static const String apiVersion = '/v1';

  /// Request timeout.
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // --- Auth ---
  static const String authOtpStart = '$apiVersion/auth/otp/start';
  static const String authOtpVerify = '$apiVersion/auth/otp/verify';
  static const String authTokenRefresh = '$apiVersion/auth/token/refresh';
  static const String authLogout = '$apiVersion/auth/logout';

  // --- Users ---
  static const String account = '$apiVersion/account';
  static const String usersMe = '$apiVersion/users/me';
  static const String usersMeProfile = '$apiVersion/users/me/profile';
  static const String usersSearch = '$apiVersion/users/search';

  // --- Chats ---
  static const String chats = '$apiVersion/chats';
  static const String chatsDirect = '$apiVersion/chats/direct';
  static const String chatsGroup = '$apiVersion/chats/group';
  static String chatMessages(String chatId) => '$apiVersion/chats/$chatId/messages';
  static String chatMessageSearch(String chatId) => '$apiVersion/chats/$chatId/messages/search';
  static String chatRead(String chatId) => '$apiVersion/chats/$chatId/read';
  static String chatDetail(String chatId) => '$apiVersion/chats/$chatId';

  // --- Messages ---
  static String message(String messageId) => '$apiVersion/messages/$messageId';
  static String messageReactions(String messageId) => '$apiVersion/messages/$messageId/reactions';

  // --- Media ---
  static const String mediaUpload = '$apiVersion/media/upload';
  static const String mediaUploads = '$apiVersion/media/uploads';
  static String mediaDetail(String mediaId) => '$apiVersion/media/$mediaId';

  // --- Stories ---
  static const String stories = '$apiVersion/stories';

  // --- Notifications ---
  static const String notificationsRegisterToken = '$apiVersion/notifications/register-token';
  static const String notificationsUnregisterToken = '$apiVersion/notifications/token';
  static const String notificationsSettings = '$apiVersion/notifications/settings';

  // --- E2EE Key Exchange ---
  static const String keyBundleUpload = '$apiVersion/keys/bundle';
  static String keyBundleFetch(String userId) => '$apiVersion/keys/bundle/$userId';
  static const String keyBundlePrekeys = '$apiVersion/keys/prekeys';

  // --- Wallet ---
  static const String wallet = '$apiVersion/wallet';
  static const String walletTransactions = '$apiVersion/wallet/transactions';
  static const String walletAddMoney = '$apiVersion/wallet/add-money';
  static const String walletAddMoneyCallback = '$apiVersion/wallet/add-money/callback';
  static const String walletWithdraw = '$apiVersion/wallet/withdraw';
  static const String walletUpiLink = '$apiVersion/wallet/upi/link';
  static String walletUpiUnlink(String accountId) => '$apiVersion/wallet/upi/$accountId';

  // --- P2P Transfers ---
  static const String transfersSend = '$apiVersion/transfers/send';
  static const String transfersRequest = '$apiVersion/transfers/request';
  static String transferDetail(String id) => '$apiVersion/transfers/$id';
  static String transferAccept(String id) => '$apiVersion/transfers/$id/accept';
  static String transferDecline(String id) => '$apiVersion/transfers/$id/decline';

  // --- Subscriptions ---
  static const String subscriptionPlans = '$apiVersion/subscriptions/plans';
  static const String subscriptionCurrent = '$apiVersion/subscriptions/current';
  static const String subscriptionSubscribe = '$apiVersion/subscriptions/subscribe';
  static const String subscriptionCancel = '$apiVersion/subscriptions/cancel';

  // --- Sticker Store ---
  static const String storeStickerPacks = '$apiVersion/store/stickers';
  static const String storeMyPacks = '$apiVersion/store/my-packs';
  static String storeStickerPack(String packId) => '$apiVersion/store/stickers/$packId';
  static String storeStickerPurchase(String packId) => '$apiVersion/store/stickers/$packId/purchase';

  // --- Ads (Non-Intrusive) ---
  static const String adsPlacement = '$apiVersion/ads/placement';
  static const String adsImpression = '$apiVersion/ads/impression';
  static const String adsClick = '$apiVersion/ads/click';

  // === Competitor-Inspired Features ===

  // --- Blocked Users (WhatsApp/Telegram/Signal) ---
  static const String blockedUsers = '$apiVersion/blocked';
  static String unblockUser(String userId) => '$apiVersion/blocked/$userId';
  static String checkBlocked(String userId) => '$apiVersion/blocked/check/$userId';

  // --- Polls (WhatsApp/Telegram) ---
  static const String polls = '$apiVersion/polls';
  static String pollDetail(String pollId) => '$apiVersion/polls/$pollId';
  static String pollVote(String pollId) => '$apiVersion/polls/$pollId/vote';
  static String pollClose(String pollId) => '$apiVersion/polls/$pollId/close';

  // --- Presence / Online Status (WhatsApp/Telegram/Discord) ---
  static String presenceStatus(String userId) => '$apiVersion/presence/$userId';
  static const String presenceSettings = '$apiVersion/presence/settings';
  static const String presenceHeartbeat = '$apiVersion/presence/heartbeat';

  // --- Pinned Messages (Telegram/Discord) ---
  static String chatPins(String chatId) => '$apiVersion/chats/$chatId/pins';
  static String chatUnpin(String chatId, String messageId) => '$apiVersion/chats/$chatId/pins/$messageId';

  // --- Chat Folders (Telegram) ---
  static const String folders = '$apiVersion/folders';
  static String folderDetail(String folderId) => '$apiVersion/folders/$folderId';
  static String folderAddChat(String folderId, String chatId) => '$apiVersion/folders/$folderId/chats/$chatId';

  // --- Scheduled Messages (Telegram) ---
  static const String scheduledMessages = '$apiVersion/scheduled';
  static String scheduledDetail(String messageId) => '$apiVersion/scheduled/$messageId';
}
