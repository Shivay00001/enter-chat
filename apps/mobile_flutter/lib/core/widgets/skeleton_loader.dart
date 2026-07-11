import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Reusable skeleton loader widget.
/// Per design system: never show blank screens for loaded content.
/// If content loads under ~150ms, shimmer is suppressed to avoid flicker.
class SkeletonLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SkeletonLoader({
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius = 4,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? Colors.grey[800]! : Colors.grey[300]!,
      highlightColor: isDark ? Colors.grey[700]! : Colors.grey[100]!,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Chat list skeleton — avatar circles, text bars, timestamp stubs.
class ChatListSkeleton extends StatelessWidget {
  final int itemCount;

  const ChatListSkeleton({this.itemCount = 8, super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemBuilder: (context, index) => const _ChatListSkeletonItem(),
    );
  }
}

class _ChatListSkeletonItem extends StatelessWidget {
  const _ChatListSkeletonItem();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const SkeletonLoader(width: 52, height: 52, borderRadius: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    SkeletonLoader(width: 120, height: 16),
                    SkeletonLoader(width: 40, height: 12),
                  ],
                ),
                const SizedBox(height: 6),
                const SkeletonLoader(width: 200, height: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Chat screen skeleton — header, alternating bubbles, composer.
class ChatScreenSkeleton extends StatelessWidget {
  const ChatScreenSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Message bubbles
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: const [
              _MessageBubbleSkeleton(isMe: false, width: 200),
              SizedBox(height: 8),
              _MessageBubbleSkeleton(isMe: true, width: 160),
              SizedBox(height: 8),
              _MessageBubbleSkeleton(isMe: false, width: 240),
              SizedBox(height: 8),
              _MessageBubbleSkeleton(isMe: true, width: 180),
              SizedBox(height: 8),
              _MessageBubbleSkeleton(isMe: false, width: 120),
            ],
          ),
        ),
        // Composer skeleton
        Container(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: const [
              SkeletonLoader(width: 32, height: 32, borderRadius: 16),
              SizedBox(width: 8),
              Expanded(child: SkeletonLoader(height: 44, borderRadius: 22)),
              SizedBox(width: 8),
              SkeletonLoader(width: 32, height: 32, borderRadius: 16),
            ],
          ),
        ),
      ],
    );
  }
}

class _MessageBubbleSkeleton extends StatelessWidget {
  final bool isMe;
  final double width;

  const _MessageBubbleSkeleton({required this.isMe, required this.width});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: SkeletonLoader(width: width, height: 40, borderRadius: 16),
    );
  }
}
