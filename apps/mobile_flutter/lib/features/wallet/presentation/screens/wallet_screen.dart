import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/providers/wallet_providers.dart';
import '../../domain/entities/wallet.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletState = ref.watch(walletProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('My Wallet'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: walletState.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Failed to load wallet: $error', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.read(walletProvider.notifier).loadWallet(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (wallet) => RefreshIndicator(
          onRefresh: () => ref.read(walletProvider.notifier).loadWallet(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildBalanceCard(context, wallet),
                const SizedBox(height: 24),
                _buildActionGrid(context),
                const SizedBox(height: 24),
                _buildUpiSection(context, ref),
                const SizedBox(height: 24),
                _buildRecentTransactions(context, ref),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard(BuildContext context, Wallet wallet) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Theme.of(context).primaryColor, Theme.of(context).primaryColorDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).primaryColor.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'Total Balance',
            style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          Text(
            wallet.balanceFormatted,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 40,
              fontWeight: FontWeight.bold,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildPrimaryActionButton(context, Icons.add, 'Add Money', () {
                // Navigate to add money
              }),
              Container(width: 1, height: 40, color: Colors.white24),
              _buildPrimaryActionButton(context, Icons.account_balance_wallet, 'Withdraw', () {
                // Navigate to withdraw
              }),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryActionButton(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 28),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionGrid(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Transfer',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _buildActionTile(context, Icons.send, 'Send Money', Colors.blue)),
              const SizedBox(width: 16),
              Expanded(child: _buildActionTile(context, Icons.request_page, 'Request Money', Colors.orange)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(BuildContext context, IconData icon, String label, Color color) {
    return Material(
      color: color.withOpacity(0.1),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          // Navigate to P2P flow
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: color.withOpacity(0.2), shape: BoxShape.circle),
                child: Icon(icon, color: color, size: 32),
              ),
              const SizedBox(height: 12),
              Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUpiSection(BuildContext context, WidgetRef ref) {
    final upiState = ref.watch(upiAccountsProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Linked UPI Accounts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              TextButton(onPressed: () {}, child: const Text('Add New')),
            ],
          ),
          const SizedBox(height: 8),
          upiState.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Text('Error: $err'),
            data: (accounts) {
              if (accounts.isEmpty) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No UPI accounts linked. Link one to easily withdraw money to your bank.'),
                  ),
                );
              }
              return Column(
                children: accounts.map((acc) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(child: Text(acc.providerIcon)),
                    title: Text(acc.upiId),
                    subtitle: Text(acc.provider?.toUpperCase() ?? 'UPI'),
                    trailing: acc.isPrimary ? const Chip(label: Text('Primary', style: TextStyle(fontSize: 10))) : null,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: Theme.of(context).cardColor,
                  ),
                )).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildRecentTransactions(BuildContext context, WidgetRef ref) {
    final txState = ref.watch(walletTransactionsProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Recent Transactions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              TextButton(onPressed: () {}, child: const Text('View All')),
            ],
          ),
          const SizedBox(height: 8),
          txState.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Text('Error: $err'),
            data: (transactions) {
              if (transactions.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: Text('No transactions yet.', style: TextStyle(color: Colors.grey)),
                  ),
                );
              }
              return Column(
                children: transactions.take(5).map((tx) => _buildTransactionTile(context, tx)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionTile(BuildContext context, WalletTransaction tx) {
    final isCredit = tx.isCredit;
    final color = isCredit ? Colors.green : Colors.red;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.1),
          child: Icon(isCredit ? Icons.arrow_downward : Icons.arrow_upward, color: color),
        ),
        title: Text(tx.description ?? (isCredit ? 'Received' : 'Sent')),
        subtitle: Text(
          tx.createdAt.toLocal().toString().split('.')[0], // simple date format
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Text(
          '${isCredit ? '+' : '-'} ${tx.amountFormatted}',
          style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
    );
  }
}
