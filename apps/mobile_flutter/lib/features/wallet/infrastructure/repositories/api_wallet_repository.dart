import '../../domain/entities/wallet.dart';
import '../../domain/repositories/wallet_repository.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';

/// API-backed wallet repository.
class ApiWalletRepository implements WalletRepository {
  final ApiClient _apiClient;

  ApiWalletRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<Wallet> getWallet() async {
    final response = await _apiClient.get(ApiConfig.wallet);
    final data = response.data as Map<String, dynamic>;
    return Wallet.fromJson(data['wallet'] as Map<String, dynamic>);
  }

  @override
  Future<List<WalletTransaction>> getTransactions({int limit = 50, int offset = 0}) async {
    final response = await _apiClient.get(
      ApiConfig.walletTransactions,
      queryParameters: {'limit': limit, 'offset': offset},
    );
    final data = response.data as Map<String, dynamic>;
    final list = data['transactions'] as List<dynamic>;
    return list.map((e) => WalletTransaction.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<Map<String, dynamic>> addMoney({
    required int amount,
    String currency = 'INR',
    String? paymentMethod,
    String? upiId,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.walletAddMoney,
      data: {
        'amount': amount,
        'currency': currency,
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
        if (upiId != null) 'upiId': upiId,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> confirmAddMoney({
    required String orderId,
    required String providerPaymentId,
    String? providerSignature,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.walletAddMoneyCallback,
      data: {
        'orderId': orderId,
        'providerPaymentId': providerPaymentId,
        if (providerSignature != null) 'providerSignature': providerSignature,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> withdraw({
    required int amount,
    String? upiAccountId,
    String? upiId,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.walletWithdraw,
      data: {
        'amount': amount,
        if (upiAccountId != null) 'upiAccountId': upiAccountId,
        if (upiId != null) 'upiId': upiId,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> sendMoney({
    required String receiverId,
    required int amount,
    String? note,
    String? chatId,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.transfersSend,
      data: {
        'receiverId': receiverId,
        'amount': amount,
        if (note != null) 'note': note,
        if (chatId != null) 'chatId': chatId,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> requestMoney({
    required String fromUserId,
    required int amount,
    String? note,
    String? chatId,
  }) async {
    final response = await _apiClient.post(
      ApiConfig.transfersRequest,
      data: {
        'fromUserId': fromUserId,
        'amount': amount,
        if (note != null) 'note': note,
        if (chatId != null) 'chatId': chatId,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<List<UpiAccount>> getUpiAccounts() async {
    final response = await _apiClient.get(ApiConfig.wallet);
    final data = response.data as Map<String, dynamic>;
    final list = data['upiAccounts'] as List<dynamic>;
    return list.map((e) => UpiAccount.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<UpiAccount> linkUpiAccount({required String upiId, String? provider}) async {
    final response = await _apiClient.post(
      ApiConfig.walletUpiLink,
      data: {'upiId': upiId, if (provider != null) 'provider': provider},
    );
    final data = response.data as Map<String, dynamic>;
    return UpiAccount.fromJson(data['upiAccount'] as Map<String, dynamic>);
  }

  @override
  Future<List<SubscriptionPlan>> getPlans() async {
    final response = await _apiClient.get(ApiConfig.subscriptionPlans);
    final data = response.data as Map<String, dynamic>;
    final list = data['plans'] as List<dynamic>;
    return list.map((e) => SubscriptionPlan.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<Subscription> getCurrentSubscription() async {
    final response = await _apiClient.get(ApiConfig.subscriptionCurrent);
    final data = response.data as Map<String, dynamic>;
    return Subscription.fromJson(data['subscription'] as Map<String, dynamic>);
  }

  @override
  Future<Map<String, dynamic>> subscribe({required String planId, String paymentSource = 'wallet'}) async {
    final response = await _apiClient.post(
      ApiConfig.subscriptionSubscribe,
      data: {'planId': planId, 'paymentSource': paymentSource},
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> cancelSubscription() async {
    final response = await _apiClient.post(ApiConfig.subscriptionCancel);
    return response.data as Map<String, dynamic>;
  }
}
