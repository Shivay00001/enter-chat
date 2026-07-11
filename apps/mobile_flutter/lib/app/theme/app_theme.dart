import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// EnterChat theme - WhatsApp/Telegram Hybrid
class AppTheme {
  AppTheme._();

  static ThemeData light() {
    return _buildTheme(Brightness.light);
  }

  static ThemeData dark() {
    return _buildTheme(Brightness.dark);
  }

  static ThemeData _buildTheme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final surfaceBase = isDark ? AppColors.darkSurfaceBase : AppColors.lightSurfaceBase;
    final surfaceRaised = isDark ? AppColors.darkSurfaceRaised : AppColors.lightSurfaceRaised;
    final surfaceSubtle = isDark ? AppColors.darkSurfaceSubtle : AppColors.lightSurfaceSubtle;
    final textPrimary = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;
    final borderSubtle = isDark ? AppColors.darkBorderSubtle : AppColors.lightBorderSubtle;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme(
        brightness: brightness,
        primary: AppColors.brandPrimary,
        onPrimary: Colors.white,
        secondary: AppColors.brandAccent,
        onSecondary: Colors.white,
        error: AppColors.brandDanger,
        onError: Colors.white,
        surface: surfaceBase,
        onSurface: textPrimary,
      ),
      scaffoldBackgroundColor: surfaceBase,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.brandPrimary, // WhatsApp classic header
        foregroundColor: Colors.white,
        elevation: 1, // Telegram has a slight shadow
        shadowColor: Colors.black.withOpacity(0.2),
        scrolledUnderElevation: 1,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surfaceBase,
        selectedItemColor: AppColors.brandPrimary,
        unselectedItemColor: textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
      ),
      cardTheme: CardThemeData(
        color: surfaceRaised,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: borderSubtle,
        thickness: 0.5,
        space: 1,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.brandAccent, // WhatsApp green FAB
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceRaised,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide.none,
        ),
        hintStyle: TextStyle(color: textSecondary, fontSize: 16),
      ),
      textTheme: TextTheme(
        displayLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: textPrimary),
        titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: Colors.white), // AppBar title usually
        titleMedium: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: textPrimary), // Chat names
        bodyLarge: TextStyle(fontSize: 16, color: textPrimary), // Messages
        bodyMedium: TextStyle(fontSize: 15, color: textPrimary), // Previews
        bodySmall: TextStyle(fontSize: 14, color: textSecondary), // Time, generic sub
        labelSmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: textSecondary),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surfaceRaised,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
      ),
    );
  }
}
