import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_config.dart';

class StickerPack {
  final String id;
  final String name;
  final String description;
  final String artist;
  final String thumbnailUrl;
  final int stickerCount;
  final int priceInr;
  final int priceUsd;
  final bool isAnimated;
  final bool isPremium;
  final bool isFree;
  final String priceFormatted;

  StickerPack({
    required this.id,
    required this.name,
    required this.description,
    required this.artist,
    required this.thumbnailUrl,
    required this.stickerCount,
    required this.priceInr,
    required this.priceUsd,
    required this.isAnimated,
    required this.isPremium,
    required this.isFree,
    required this.priceFormatted,
  });

  factory StickerPack.fromJson(Map<String, dynamic> json) {
    return StickerPack(
      id: json['id'],
      name: json['name'],
      description: json['description'] ?? '',
      artist: json['artist'] ?? '',
      thumbnailUrl: json['thumbnailUrl'] ?? '',
      stickerCount: json['stickerCount'] ?? 0,
      priceInr: json['priceInr'] ?? 0,
      priceUsd: json['priceUsd'] ?? 0,
      isAnimated: json['isAnimated'] ?? false,
      isPremium: json['isPremium'] ?? false,
      isFree: json['isFree'] ?? true,
      priceFormatted: json['priceFormatted'] ?? 'Free',
    );
  }
}

final stickerStoreProvider = FutureProvider.autoDispose<List<StickerPack>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get(ApiConfig.storeStickerPacks);
  final data = response.data as Map<String, dynamic>;
  final packs = data['packs'] as List<dynamic>;
  return packs.map((p) => StickerPack.fromJson(p)).toList();
});

final purchaseStickerProvider = Provider((ref) {
  final apiClient = ref.read(apiClientProvider);
  return (String packId) async {
    final response = await apiClient.post(ApiConfig.storeStickerPurchase(packId));
    return response.data;
  };
});
