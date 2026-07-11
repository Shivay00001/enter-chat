import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

/// Avatar widget with optional presence indicator dot.
class AppAvatar extends StatelessWidget {
  final String? imageUrl;
  final String name;
  final double radius;
  final bool showPresence;
  final bool isOnline;

  const AppAvatar({
    this.imageUrl,
    required this.name,
    this.radius = 24,
    this.showPresence = false,
    this.isOnline = false,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        CircleAvatar(
          radius: radius,
          backgroundColor: AppColors.brandPrimary.withOpacity(0.2),
          backgroundImage: imageUrl != null ? NetworkImage(imageUrl!) : null,
          child: imageUrl == null
              ? Text(
                  _initials(name),
                  style: TextStyle(
                    color: AppColors.brandPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: radius * 0.7,
                  ),
                )
              : null,
        ),
        if (showPresence)
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: radius * 0.5,
              height: radius * 0.5,
              decoration: BoxDecoration(
                color: isOnline ? AppColors.online : AppColors.offline,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  width: 2,
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
