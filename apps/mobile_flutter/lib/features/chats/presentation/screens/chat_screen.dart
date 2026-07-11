import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/app_avatar.dart';
import '../../../../core/widgets/skeleton_loader.dart';
import '../../application/providers/chat_providers.dart';
import '../../domain/entities/chat.dart';
import 'package:intl/intl.dart';
import 'dart:async';

/// Individual chat / conversation screen — Riverpod-connected.
class ChatScreen extends ConsumerStatefulWidget {
  final String chatId;

  const ChatScreen({required this.chatId, super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _typingTimer;

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final notifier = ref.read(typingProvider(widget.chatId).notifier);
    if (_messageController.text.isNotEmpty) {
      notifier.setTyping(true);
      _typingTimer?.cancel();
      _typingTimer = Timer(const Duration(seconds: 3), () {
        notifier.setTyping(false);
      });
    } else {
      notifier.setTyping(false);
    }
  }

  @override
  void dispose() {
    _messageController.removeListener(_onTextChanged);
    _messageController.dispose();
    _scrollController.dispose();
    _typingTimer?.cancel();
    // Stop typing when leaving screen
    ref.read(typingProvider(widget.chatId).notifier).setTyping(false);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messagesState = ref.watch(messagesProvider(widget.chatId));

    return Scaffold(
      appBar: AppBar(
        leadingWidth: 32,
        title: Row(
          children: [
            const AppAvatar(name: 'Chat', radius: 18, showPresence: true, isOnline: true),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Chat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                Consumer(
                  builder: (context, ref, child) {
                    final typers = ref.watch(typingProvider(widget.chatId));
                    if (typers.isNotEmpty) {
                      return Text('typing...', style: TextStyle(fontSize: 12, color: AppColors.brandPrimary, fontStyle: FontStyle.italic));
                    }
                    return Text('online', style: TextStyle(fontSize: 12, color: AppColors.online));
                  },
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.call_outlined), onPressed: () {}),
          IconButton(icon: const Icon(Icons.videocam_outlined), onPressed: () {}),
          IconButton(icon: const Icon(Icons.more_vert), onPressed: () {}),
        ],
      ),
      body: messagesState.when(
        loading: () => const ChatScreenSkeleton(),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.brandDanger),
              const SizedBox(height: 16),
              Text('Failed to load messages', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref.read(messagesProvider(widget.chatId).notifier).loadMessages(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (messages) => Column(
          children: [
            Expanded(
              child: messages.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.lock_outline, size: 48, color: AppColors.brandPrimary.withOpacity(0.5)),
                          const SizedBox(height: 16),
                          Text(
                            'Messages are end-to-end encrypted.\nSay hello! 👋',
                            style: Theme.of(context).textTheme.bodySmall,
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      reverse: true,
                      padding: const EdgeInsets.all(12),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final msg = messages[messages.length - 1 - index];
                        final isMe = msg.senderId == 'current_user';
                        return _MessageBubble(
                          message: msg,
                          isMe: isMe,
                          onDelete: () => ref.read(messagesProvider(widget.chatId).notifier).deleteMessage(msg.id, everyone: true),
                          onEdit: () => _showEditDialog(context, msg),
                          onReact: (emoji) => ref.read(messagesProvider(widget.chatId).notifier).reactToMessage(msg.id, emoji),
                        );
                      },
                    ),
            ),
            _ChatComposer(
              controller: _messageController,
              onSend: _onSend,
            ),
          ],
        ),
      ),
    );
  }

  void _onSend() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    ref.read(messagesProvider(widget.chatId).notifier).sendMessage(
      msgType: 'text',
      content: text,
    );
    _messageController.clear();
  }
  void _showEditDialog(BuildContext context, Message msg) {
    final controller = TextEditingController(text: msg.body);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Message'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'New message'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              ref.read(messagesProvider(widget.chatId).notifier).editMessage(msg.id, controller.text);
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;
  final VoidCallback onDelete;
  final VoidCallback onEdit;
  final Function(String emoji) onReact;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.onDelete,
    required this.onEdit,
    required this.onReact,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bubbleColor = isMe
        ? (isDark ? AppColors.sentBubbleDark : AppColors.sentBubbleLight)
        : (isDark ? AppColors.receivedBubbleDark : AppColors.receivedBubbleLight);

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _showMessageActions(context),
        onDoubleTap: () => onReact('❤️'), // Quick react like Instagram
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
          margin: const EdgeInsets.symmetric(vertical: 2, horizontal: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: bubbleColor,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isMe ? 16 : 0), // Telegram tail
              bottomRight: Radius.circular(isMe ? 0 : 16), // Telegram tail
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 1,
                offset: const Offset(0, 1), // WhatsApp slight shadow
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(message.body ?? '', style: const TextStyle(fontSize: 16, height: 1.2)),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (message.isEdited) ...[
                    Text('edited ', style: TextStyle(fontSize: 11, color: Theme.of(context).textTheme.bodySmall?.color?.withOpacity(0.7), fontStyle: FontStyle.italic)),
                  ],
                  Text(
                    _formatMessageTime(message.createdAt),
                    style: TextStyle(fontSize: 11, color: Theme.of(context).textTheme.bodySmall?.color?.withOpacity(0.7)),
                  ),
                  if (isMe) ...[
                    const SizedBox(width: 4),
                    const Icon(Icons.done_all, size: 14, color: Colors.blue), // WhatsApp read receipt
                  ],
                ],
              ),
              if (message.reactions.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: message.reactions.map((r) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Theme.of(context).scaffoldBackgroundColor.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Theme.of(context).dividerColor.withOpacity(0.1)),
                      ),
                      child: Text('${r.emoji} ${r.count}', style: const TextStyle(fontSize: 12)),
                    )).toList(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatMessageTime(String iso) {
    try {
      return DateFormat.jm().format(DateTime.parse(iso));
    } catch (_) {
      return '';
    }
  }

  void _showMessageActions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  for (final emoji in ['👍', '❤️', '😂', '😮', '😢', '🙏'])
                    GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        onReact(emoji);
                      },
                      child: Text(emoji, style: const TextStyle(fontSize: 28)),
                    ),
                ],
              ),
            ),
            const Divider(),
            ListTile(leading: const Icon(Icons.reply), title: const Text('Reply'), onTap: () => Navigator.pop(context)),
            ListTile(leading: const Icon(Icons.content_copy), title: const Text('Copy'), onTap: () => Navigator.pop(context)),
            ListTile(leading: const Icon(Icons.star_border), title: const Text('Star'), onTap: () => Navigator.pop(context)),
            if (isMe) ...[
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('Edit'),
                onTap: () {
                  Navigator.pop(context);
                  onEdit();
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete, color: AppColors.brandDanger),
                title: const Text('Delete', style: TextStyle(color: AppColors.brandDanger)),
                onTap: () {
                  Navigator.pop(context);
                  onDelete();
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ChatComposer extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;

  const _ChatComposer({required this.controller, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor, // WhatsApp flat solid background
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Theme.of(context).dividerColor.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.emoji_emotions_outlined),
                      color: Theme.of(context).textTheme.bodySmall?.color,
                      onPressed: () {},
                    ),
                    Expanded(
                      child: TextField(
                        controller: controller,
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          border: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                        textCapitalization: TextCapitalization.sentences,
                        minLines: 1,
                        maxLines: 5,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.attach_file),
                      color: Theme.of(context).textTheme.bodySmall?.color,
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          backgroundColor: Colors.transparent,
                          builder: (context) => _buildAttachmentMenu(context),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.camera_alt), // Snapchat style camera inline
                      color: Theme.of(context).textTheme.bodySmall?.color,
                      onPressed: () {},
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              margin: const EdgeInsets.only(bottom: 2),
              decoration: const BoxDecoration(
                color: AppColors.brandPrimary, // WhatsApp green
                shape: BoxShape.circle,
              ),
              child: IconButton(
                // WhatsApp style: Mic if empty, Send if typing
                icon: Icon(controller.text.isEmpty ? Icons.mic : Icons.send, size: 24),
                color: Colors.white,
                onPressed: controller.text.isEmpty ? () {} : onSend,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentMenu(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(32),
      ),
      child: SafeArea(
        child: GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          padding: const EdgeInsets.all(24),
          mainAxisSpacing: 24,
          crossAxisSpacing: 24,
          children: [
            _AttachOption(icon: Icons.photo_library, label: 'Gallery', color: Colors.purpleAccent, onTap: () => Navigator.pop(context)),
            _AttachOption(icon: Icons.camera_alt, label: 'Camera', color: Colors.redAccent, onTap: () => Navigator.pop(context)),
            _AttachOption(icon: Icons.insert_drive_file, label: 'Document', color: Colors.blueAccent, onTap: () => Navigator.pop(context)),
            _AttachOption(icon: Icons.location_on, label: 'Location', color: Colors.greenAccent, onTap: () => Navigator.pop(context)),
            _AttachOption(icon: Icons.person, label: 'Contact', color: Colors.orangeAccent, onTap: () => Navigator.pop(context)),
            _AttachOption(icon: Icons.poll, label: 'Poll', color: Colors.tealAccent, onTap: () => Navigator.pop(context)),
          ],
        ),
      ),
    );
  }
}

class _AttachOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _AttachOption({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 28, backgroundColor: color.withOpacity(0.15), child: Icon(icon, color: color)),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
