import 'package:flutter/material.dart';

/// EnterChat semantic color tokens - Telegram / WhatsApp Hybrid Edition.
class AppColors {
  AppColors._();

  // WhatsApp-inspired primary branding
  static const Color brandPrimary = Color(0xFF128C7E);     // WhatsApp Teal
  static const Color brandPrimaryPressed = Color(0xFF075E54); // Darker Teal
  static const Color brandAccent = Color(0xFF25D366);      // WhatsApp Light Green
  
  // Snapchat/Instagram inspired accents
  static const Color snapYellow = Color(0xFFFFFC00);
  static const Color instaPurple = Color(0xFFC13584);
  static const Color instaOrange = Color(0xFFF56040);

  // Status colors
  static const Color brandSuccess = Color(0xFF4CAF50);
  static const Color brandWarning = Color(0xFFFF9800);
  static const Color brandDanger = Color(0xFFF44336);

  // Light mode surfaces (Telegram inspired - crisp and clean)
  static const Color lightSurfaceBase = Color(0xFFFFFFFF); // Pure white background
  static const Color lightSurfaceRaised = Color(0xFFF5F5F5);
  static const Color lightSurfaceSubtle = Color(0xFFF0F2F5); // WhatsApp chat background
  static const Color lightTextPrimary = Color(0xFF000000);
  static const Color lightTextSecondary = Color(0xFF8A8D91);
  static const Color lightBorderSubtle = Color(0xFFE0E0E0);

  // Dark mode surfaces (Telegram Night Mode inspired - deep blue/gray)
  static const Color darkSurfaceBase = Color(0xFF111E28); // Telegram dark tint
  static const Color darkSurfaceRaised = Color(0xFF1C2C3A);
  static const Color darkSurfaceSubtle = Color(0xFF223545);
  static const Color darkTextPrimary = Color(0xFFFFFFFF);
  static const Color darkTextSecondary = Color(0xFF8B9CB0);
  static const Color darkBorderSubtle = Color(0xFF162531);

  // Telegram/WhatsApp Message Bubbles
  static const Color sentBubbleLight = Color(0xFFE1FFC7); // WhatsApp classic sent green
  static const Color sentBubbleDark = Color(0xFF2B5278);  // Telegram classic sent dark blue
  static const Color receivedBubbleLight = Color(0xFFFFFFFF);
  static const Color receivedBubbleDark = Color(0xFF182533); // Telegram received dark

  static const Color online = Color(0xFF4CAF50);
  static const Color offline = Color(0xFF9E9E9E);
  static const Color unreadBadge = brandPrimary; // WhatsApp style

  // Instagram Story Ring Gradient
  static const LinearGradient instaGradient = LinearGradient(
    colors: [Color(0xFF833AB4), Color(0xFFFD1D1D), Color(0xFFF56040)],
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
  );
}
