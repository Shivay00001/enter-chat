/// Wallet entity representing a user's digital wallet.
class Wallet {
  final String id;
  final int balance; // In paisa/cents
  final String currency;
  final bool isFrozen;
  final String balanceFormatted;

  const Wallet({
    required this.id,
    required this.balance,
    required this.currency,
    required this.isFrozen,
    required this.balanceFormatted,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'] as String,
      balance: json['balance'] as int,
      currency: json['currency'] as String? ?? 'INR',
      isFrozen: json['isFrozen'] as bool? ?? false,
      balanceFormatted: json['balanceFormatted'] as String? ?? '₹0.00',
    );
  }

  double get balanceMajor => balance / 100;
}

/// Transaction entity for wallet ledger.
class WalletTransaction {
  final String id;
  final String txType; // 'credit' or 'debit'
  final String source; // 'add_money', 'p2p_send', etc.
  final int amount;
  final int balanceAfter;
  final String currency;
  final String? description;
  final String? referenceId;
  final String amountFormatted;
  final DateTime createdAt;

  const WalletTransaction({
    required this.id,
    required this.txType,
    required this.source,
    required this.amount,
    required this.balanceAfter,
    required this.currency,
    this.description,
    this.referenceId,
    required this.amountFormatted,
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id'] as String,
      txType: json['txType'] as String,
      source: json['source'] as String,
      amount: json['amount'] as int,
      balanceAfter: json['balanceAfter'] as int,
      currency: json['currency'] as String? ?? 'INR',
      description: json['description'] as String?,
      referenceId: json['referenceId'] as String?,
      amountFormatted: json['amountFormatted'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  bool get isCredit => txType == 'credit';
}

/// UPI linked account.
class UpiAccount {
  final String id;
  final String upiId;
  final String? provider; // 'bhim', 'gpay', 'phonepe', 'paytm'
  final bool isPrimary;
  final bool isVerified;
  final String? displayName;

  const UpiAccount({
    required this.id,
    required this.upiId,
    this.provider,
    required this.isPrimary,
    required this.isVerified,
    this.displayName,
  });

  factory UpiAccount.fromJson(Map<String, dynamic> json) {
    return UpiAccount(
      id: json['id'] as String,
      upiId: json['upiId'] as String,
      provider: json['provider'] as String?,
      isPrimary: json['isPrimary'] as bool? ?? false,
      isVerified: json['isVerified'] as bool? ?? false,
      displayName: json['displayName'] as String?,
    );
  }

  /// Icon name for the UPI provider.
  String get providerIcon {
    switch (provider) {
      case 'gpay': return '💚';
      case 'phonepe': return '💜';
      case 'paytm': return '💙';
      case 'bhim': return '🇮🇳';
      case 'mobikwik': return '🔵';
      default: return '💰';
    }
  }
}

/// P2P Transfer entity.
class P2PTransfer {
  final String id;
  final String senderId;
  final String receiverId;
  final int amount;
  final String currency;
  final String status;
  final String transferType;
  final String? note;
  final String? senderName;
  final String? receiverName;
  final DateTime createdAt;

  const P2PTransfer({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.transferType,
    this.note,
    this.senderName,
    this.receiverName,
    required this.createdAt,
  });

  factory P2PTransfer.fromJson(Map<String, dynamic> json) {
    return P2PTransfer(
      id: json['id'] as String,
      senderId: json['senderId'] as String,
      receiverId: json['receiverId'] as String,
      amount: json['amount'] as int,
      currency: json['currency'] as String? ?? 'INR',
      status: json['status'] as String,
      transferType: json['transferType'] as String,
      note: json['note'] as String?,
      senderName: json['senderName'] as String?,
      receiverName: json['receiverName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Subscription plan.
class SubscriptionPlan {
  final String id;
  final String tier;
  final String name;
  final String? description;
  final int priceInr;
  final int priceUsd;
  final List<String> features;
  final int maxDevices;
  final String priceInrFormatted;
  final String priceUsdFormatted;

  const SubscriptionPlan({
    required this.id,
    required this.tier,
    required this.name,
    this.description,
    required this.priceInr,
    required this.priceUsd,
    required this.features,
    required this.maxDevices,
    required this.priceInrFormatted,
    required this.priceUsdFormatted,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlan(
      id: json['id'] as String,
      tier: json['tier'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      priceInr: json['priceInr'] as int? ?? 0,
      priceUsd: json['priceUsd'] as int? ?? 0,
      features: (json['features'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      maxDevices: json['maxDevices'] as int? ?? 1,
      priceInrFormatted: json['priceInrFormatted'] as String? ?? '',
      priceUsdFormatted: json['priceUsdFormatted'] as String? ?? '',
    );
  }

  bool get isFree => tier == 'free';
}

/// Current subscription state.
class Subscription {
  final String tier;
  final String status;
  final String planName;
  final List<String> features;
  final int maxDevices;
  final bool isFreeTier;

  const Subscription({
    required this.tier,
    required this.status,
    required this.planName,
    required this.features,
    required this.maxDevices,
    required this.isFreeTier,
  });

  factory Subscription.fromJson(Map<String, dynamic> json) {
    return Subscription(
      tier: json['tier'] as String? ?? 'free',
      status: json['status'] as String? ?? 'active',
      planName: json['planName'] as String? ?? 'Free',
      features: (json['features'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      maxDevices: json['maxDevices'] as int? ?? 1,
      isFreeTier: json['isFreeTier'] as bool? ?? true,
    );
  }

  bool get isPremium => tier == 'premium' || tier == 'business';
}
