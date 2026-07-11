import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../application/providers/store_providers.dart';

class StickerStoreScreen extends ConsumerWidget {
  const StickerStoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storeState = ref.watch(stickerStoreProvider);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Sticker Store'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: storeState.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Failed to load store: $err'),
              ElevatedButton(
                onPressed: () => ref.invalidate(stickerStoreProvider),
                child: const Text('Retry'),
              )
            ],
          ),
        ),
        data: (packs) {
          if (packs.isEmpty) {
            return const Center(child: Text('No sticker packs available right now.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(stickerStoreProvider),
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.75,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: packs.length,
              itemBuilder: (context, index) {
                return _buildStickerPackCard(context, ref, packs[index]);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildStickerPackCard(BuildContext context, WidgetRef ref, StickerPack pack) {
    final theme = Theme.of(context);

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: theme.primaryColor.withOpacity(0.05),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: pack.thumbnailUrl.isNotEmpty
                  ? ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                      child: Image.network(pack.thumbnailUrl, fit: BoxFit.cover),
                    )
                  : Icon(Icons.emoji_emotions, size: 64, color: theme.primaryColor),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        pack.name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (pack.isPremium)
                      const Icon(Icons.star, color: Colors.amber, size: 16),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${pack.stickerCount} stickers',
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: pack.isFree ? theme.primaryColor.withOpacity(0.1) : theme.primaryColor,
                      foregroundColor: pack.isFree ? theme.primaryColor : Colors.white,
                      elevation: pack.isFree ? 0 : 2,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _purchasePack(context, ref, pack),
                    child: Text(pack.priceFormatted, style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _purchasePack(BuildContext context, WidgetRef ref, StickerPack pack) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );

      final purchaseFn = ref.read(purchaseStickerProvider);
      await purchaseFn(pack.id);

      if (context.mounted) {
        Navigator.of(context).pop(); // dismiss loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Successfully purchased ${pack.name}!')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context).pop(); // dismiss loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Purchase failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }
}
