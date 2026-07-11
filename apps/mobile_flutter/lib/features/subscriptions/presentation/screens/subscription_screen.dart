import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:enterchat/features/wallet/application/providers/wallet_providers.dart';
import 'package:enterchat/features/wallet/domain/entities/wallet.dart';

class SubscriptionScreen extends ConsumerWidget {
  const SubscriptionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subState = ref.watch(subscriptionProvider);
    final plansState = ref.watch(subscriptionPlansProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('EnterChat Premium'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: subState.when(
              loading: () => const SizedBox(height: 100, child: Center(child: CircularProgressIndicator())),
              error: (err, _) => Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text('Failed to load subscription: $err'),
              ),
              data: (sub) => _buildCurrentSubscriptionCard(context, sub),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text(
                'Available Plans',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
          ),
          plansState.when(
            loading: () => const SliverToBoxAdapter(child: Center(child: CircularProgressIndicator())),
            error: (err, _) => SliverToBoxAdapter(child: Center(child: Text('Error: $err'))),
            data: (plans) {
              final paidPlans = plans.where((p) => !p.isFree).toList();
              return SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildPlanCard(context, ref, paidPlans[index]),
                    childCount: paidPlans.length,
                  ),
                ),
              );
            },
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  Widget _buildCurrentSubscriptionCard(BuildContext context, Subscription sub) {
    final isPremium = sub.isPremium;
    final theme = Theme.of(context);
    final primaryColor = isPremium ? Colors.purpleAccent : theme.primaryColor;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, primaryColor.withOpacity(0.6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isPremium ? Icons.star : Icons.account_circle, color: Colors.white, size: 32),
              const SizedBox(width: 12),
              Text(
                'Current Plan',
                style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            sub.planName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.bold,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 24),
          ...sub.features.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white70, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(f, style: const TextStyle(color: Colors.white, fontSize: 16))),
              ],
            ),
          )),
          const SizedBox(height: 24),
          if (isPremium)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  // Cancel subscription
                },
                child: const Text('Manage Subscription', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPlanCard(BuildContext context, WidgetRef ref, SubscriptionPlan plan) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.purple.withOpacity(0.3), width: 1),
      ),
      elevation: 4,
      shadowColor: Colors.purple.withOpacity(0.1),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  plan.name,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.purple),
                ),
                Text(
                  '${plan.priceInrFormatted}/mo',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            if (plan.description != null) ...[
              const SizedBox(height: 8),
              Text(plan.description!, style: const TextStyle(color: Colors.grey)),
            ],
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 16),
            ...plan.features.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 12.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.star_rate, color: Colors.amber, size: 20),
                  const SizedBox(width: 12),
                  Expanded(child: Text(f, style: const TextStyle(fontSize: 15))),
                ],
              ),
            )),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.purple,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () async {
                  // Subscribe using wallet balance
                  try {
                    await ref.read(subscriptionProvider.notifier).subscribe(plan.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Subscribed successfully!')),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
                      );
                    }
                  }
                },
                child: const Text('Upgrade Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
