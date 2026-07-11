import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/entities/wallet.dart';
import '../../domain/repositories/wallet_repository.dart';
import '../../infrastructure/repositories/api_wallet_repository.dart';
import '../../../../core/network/api_client.dart';

// --- Repository provider ---
final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return ApiWalletRepository(apiClient: apiClient);
});

// --- Wallet balance state ---
final walletProvider = StateNotifierProvider<WalletNotifier, AsyncValue<Wallet>>((ref) {
  final repo = ref.read(walletRepositoryProvider);
  return WalletNotifier(repo);
});

class WalletNotifier extends StateNotifier<AsyncValue<Wallet>> {
  final WalletRepository _repo;

  WalletNotifier(this._repo) : super(const AsyncValue.loading()) {
    loadWallet();
  }

  Future<void> loadWallet() async {
    state = const AsyncValue.loading();
    try {
      final wallet = await _repo.getWallet();
      state = AsyncValue.data(wallet);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Map<String, dynamic>> addMoney({
    required int amount,
    String? paymentMethod,
    String? upiId,
  }) async {
    final result = await _repo.addMoney(
      amount: amount,
      paymentMethod: paymentMethod,
      upiId: upiId,
    );
    return result;
  }

  Future<Map<String, dynamic>> confirmAddMoney({
    required String orderId,
    required String providerPaymentId,
  }) async {
    final result = await _repo.confirmAddMoney(
      orderId: orderId,
      providerPaymentId: providerPaymentId,
    );
    // Refresh wallet after successful add
    await loadWallet();
    return result;
  }

  Future<void> withdraw({required int amount, String? upiId}) async {
    await _repo.withdraw(amount: amount, upiId: upiId);
    await loadWallet();
  }

  Future<Map<String, dynamic>> sendMoney({
    required String receiverId,
    required int amount,
    String? note,
    String? chatId,
  }) async {
    final result = await _repo.sendMoney(
      receiverId: receiverId,
      amount: amount,
      note: note,
      chatId: chatId,
    );
    await loadWallet();
    return result;
  }
}

// --- Transaction history ---
final walletTransactionsProvider =
    StateNotifierProvider<TransactionsNotifier, AsyncValue<List<WalletTransaction>>>((ref) {
  final repo = ref.read(walletRepositoryProvider);
  return TransactionsNotifier(repo);
});

class TransactionsNotifier extends StateNotifier<AsyncValue<List<WalletTransaction>>> {
  final WalletRepository _repo;

  TransactionsNotifier(this._repo) : super(const AsyncValue.loading()) {
    loadTransactions();
  }

  Future<void> loadTransactions() async {
    state = const AsyncValue.loading();
    try {
      final txs = await _repo.getTransactions();
      state = AsyncValue.data(txs);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

// --- UPI accounts ---
final upiAccountsProvider = FutureProvider<List<UpiAccount>>((ref) async {
  final repo = ref.read(walletRepositoryProvider);
  return repo.getUpiAccounts();
});

// --- Subscription state ---
final subscriptionProvider = StateNotifierProvider<SubscriptionNotifier, AsyncValue<Subscription>>((ref) {
  final repo = ref.read(walletRepositoryProvider);
  return SubscriptionNotifier(repo);
});

class SubscriptionNotifier extends StateNotifier<AsyncValue<Subscription>> {
  final WalletRepository _repo;

  SubscriptionNotifier(this._repo) : super(const AsyncValue.loading()) {
    loadSubscription();
  }

  Future<void> loadSubscription() async {
    state = const AsyncValue.loading();
    try {
      final sub = await _repo.getCurrentSubscription();
      state = AsyncValue.data(sub);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> subscribe(String planId) async {
    await _repo.subscribe(planId: planId);
    await loadSubscription();
  }

  Future<void> cancel() async {
    await _repo.cancelSubscription();
    await loadSubscription();
  }
}

// --- Subscription plans ---
final subscriptionPlansProvider = FutureProvider<List<SubscriptionPlan>>((ref) async {
  final repo = ref.read(walletRepositoryProvider);
  return repo.getPlans();
});
