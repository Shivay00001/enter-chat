import '../entities/wallet.dart';

/// Wallet repository port — swappable between mock and API.
abstract class WalletRepository {
  /// Get wallet balance and info.
  Future<Wallet> getWallet();

  /// Get transaction history.
  Future<List<WalletTransaction>> getTransactions({int limit, int offset});

  /// Initiate add money flow.
  Future<Map<String, dynamic>> addMoney({
    required int amount,
    String currency = 'INR',
    String? paymentMethod,
    String? upiId,
  });

  /// Confirm add money (callback verification).
  Future<Map<String, dynamic>> confirmAddMoney({
    required String orderId,
    required String providerPaymentId,
    String? providerSignature,
  });

  /// Withdraw to UPI/bank.
  Future<Map<String, dynamic>> withdraw({
    required int amount,
    String? upiAccountId,
    String? upiId,
  });

  /// Send money to another user.
  Future<Map<String, dynamic>> sendMoney({
    required String receiverId,
    required int amount,
    String? note,
    String? chatId,
  });

  /// Request money from another user.
  Future<Map<String, dynamic>> requestMoney({
    required String fromUserId,
    required int amount,
    String? note,
    String? chatId,
  });

  /// Get linked UPI accounts.
  Future<List<UpiAccount>> getUpiAccounts();

  /// Link a UPI account.
  Future<UpiAccount> linkUpiAccount({required String upiId, String? provider});

  /// Get subscription plans.
  Future<List<SubscriptionPlan>> getPlans();

  /// Get current subscription.
  Future<Subscription> getCurrentSubscription();

  /// Subscribe to a plan.
  Future<Map<String, dynamic>> subscribe({required String planId, String paymentSource = 'wallet'});

  /// Cancel subscription.
  Future<Map<String, dynamic>> cancelSubscription();
}
