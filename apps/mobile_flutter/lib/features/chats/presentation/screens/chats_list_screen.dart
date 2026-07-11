import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/app_avatar.dart';
import '../../../../core/widgets/skeleton_loader.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../application/providers/chat_providers.dart';
import '../../domain/entities/chat.dart';
import 'package:intl/intl.dart';
import '../../../stories/presentation/widgets/story_feed_widget.dart';
import '../../../stories/application/providers/story_providers.dart';

/// Main chats list screen — Riverpod-connected, default landing tab.
class ChatsListScreen extends ConsumerWidget {
  const ChatsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatListState = ref.watch(chatListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('EnterChat', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          PopupMenuButton(
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'new_group', child: Text('New Group')),
              const PopupMenuItem(value: 'new_channel', child: Text('New Channel')),
              const PopupMenuItem(value: 'starred', child: Text('Starred Messages')),
            ],
            onSelected: (value) {
              if (value == 'new_group') context.push(RouteNames.createGroup);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Contact picker launched (Stub)')),
          );
        },
        child: const Icon(Icons.chat),
      ),
      body: chatListState.when(
        loading: () => const ChatListSkeleton(),
        error: (error, _) => EmptyState(
          icon: Icons.error_outline,
          title: 'Something went wrong',
          subtitle: error.toString(),
          actionLabel: 'Retry',
          onAction: () => ref.read(chatListProvider.notifier).loadChats(),
        ),
        data: (chats) {
          if (chats.isEmpty) {
            return EmptyState(
              icon: Icons.chat_bubble_outline,
              title: 'Start your first conversation',
              subtitle: 'Tap the button below to start chatting securely.',
              actionLabel: 'New Chat',
              onAction: () {},
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              // Refresh both chats and stories
              ref.read(chatListProvider.notifier).refresh();
              ref.read(storyFeedProvider.notifier).refresh();
            },
            child: Column(
              children: [
                const StoryFeedWidget(),
                const Divider(height: 1, thickness: 1),
                Expanded(
                  child: ListView.builder(
                    itemCount: chats.length,
                    itemBuilder: (context, index) {
                      final chat = chats[index];
                      return _ChatListTile(
                        chat: chat,
                        onTap: () => context.go(RouteNames.chat(chat.id)),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ChatListTile extends StatelessWidget {
  final Chat chat;
  final VoidCallback onTap;

  const _ChatListTile({required this.chat, required this.onTap});

  @override
  @override
  Widget build(BuildContext context) {
    final isMeLastSender = chat.lastMessage?.senderId == 'my_user_id'; // In real app, check against current user ID
    final isRead = true; // In real app, check if lastMessage.id <= chatMember.lastReadAt
    
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            AppAvatar(
              name: chat.title ?? 'Chat',
              imageUrl: chat.avatarUrl,
              radius: 28, // Telegram size
              showPresence: chat.type == 'direct',
              isOnline: false,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (chat.type == 'group') ...[
                        Icon(Icons.group, size: 16, color: Theme.of(context).textTheme.bodySmall?.color),
                        const SizedBox(width: 4),
                      ],
                      Expanded(
                        child: Text(
                          chat.title ?? 'Chat',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: chat.unreadCount > 0 ? FontWeight.bold : FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        _formatTime(chat.lastMessage?.createdAt),
                        style: TextStyle(
                          fontSize: 13,
                          color: chat.unreadCount > 0
                              ? AppColors.brandAccent
                              : Theme.of(context).textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      // WhatsApp style double check
                      if (isMeLastSender) ...[
                        Icon(
                          isRead ? Icons.done_all : Icons.done,
                          size: 16,
                          color: isRead ? Colors.blue : Theme.of(context).textTheme.bodySmall?.color,
                        ),
                        const SizedBox(width: 4),
                      ],
                      
                      // Snapchat style media indicator square
                      if (chat.lastMessage?.type == 'image') ...[
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.instaPurple,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      if (chat.lastMessage?.type == 'video') ...[
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.brandDanger,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],

                      Expanded(
                        child: Text(
                          _previewText(chat),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            color: Theme.of(context).textTheme.bodySmall?.color,
                            fontWeight: chat.unreadCount > 0 ? FontWeight.w500 : FontWeight.normal,
                          ),
                        ),
                      ),
                      if (chat.unreadCount > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.brandAccent, // WhatsApp green
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            chat.unreadCount > 99 ? '99+' : '${chat.unreadCount}',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _previewText(Chat chat) {
    if (chat.lastMessage == null) return 'No messages yet';
    final lm = chat.lastMessage!;
    String content = lm.preview ?? lm.type;
    if (lm.type == 'image') content = 'Photo';
    if (lm.type == 'video') content = 'Video';
    
    if (chat.type == 'group') {
      return '${lm.senderDisplayName}: $content';
    }
    return content;
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso);
      final now = DateTime.now();
      final diff = now.difference(dt);

      if (diff.inDays == 0) return DateFormat.jm().format(dt);
      if (diff.inDays == 1) return 'Yesterday';
      if (diff.inDays < 7) return DateFormat.E().format(dt);
      return DateFormat.MMMd().format(dt);
    } catch (_) {
      return '';
    }
  }
}
