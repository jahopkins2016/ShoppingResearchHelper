import 'package:flutter/material.dart';

class AppTheme {
  // Brand colours
  static const Color primary = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFFEFF6FF);
  static const Color textDark = Color(0xFF191C1D);
  static const Color textSecondary = Color(0xFF434655);
  static const Color background = Color(0xFFF8F9FA);
  static const Color divider = Color(0xFFE7E8E9);
  static const Color placeholder = Color(0xFFEDEEEF);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFDC2626);

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          brightness: Brightness.light,
          surface: background,
        ),
        scaffoldBackgroundColor: background,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: textDark,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          titleTextStyle: TextStyle(
            color: textDark,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: primary,
            side: const BorderSide(color: primary),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: divider),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: divider),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: primary, width: 2),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: divider),
          ),
        ),
        dividerTheme: const DividerThemeData(color: divider, space: 1),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Colors.white,
          selectedItemColor: primary,
          unselectedItemColor: textSecondary,
          type: BottomNavigationBarType.fixed,
          elevation: 8,
        ),
        textTheme: const TextTheme(
          titleLarge: TextStyle(
              color: textDark, fontSize: 20, fontWeight: FontWeight.w700),
          titleMedium: TextStyle(
              color: textDark, fontSize: 16, fontWeight: FontWeight.w600),
          titleSmall: TextStyle(
              color: textDark, fontSize: 14, fontWeight: FontWeight.w600),
          bodyLarge: TextStyle(color: textDark, fontSize: 16),
          bodyMedium: TextStyle(color: textSecondary, fontSize: 14),
          bodySmall: TextStyle(color: textSecondary, fontSize: 12),
          labelLarge: TextStyle(
              color: textDark, fontSize: 14, fontWeight: FontWeight.w600),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: placeholder,
          selectedColor: primaryLight,
          labelStyle:
              const TextStyle(color: textDark, fontWeight: FontWeight.w500),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      );

  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primary,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF111318),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1C1F26),
          foregroundColor: Color(0xFFE8EAED),
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          titleTextStyle: TextStyle(
            color: Color(0xFFE8EAED),
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF93C5FD),
            side: const BorderSide(color: Color(0xFF93C5FD)),
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1C1F26),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF3A3D47)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF3A3D47)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: primary, width: 2),
          ),
          hintStyle: const TextStyle(color: Color(0xFF6B7280)),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1C1F26),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFF2E3138)),
          ),
        ),
        dividerTheme:
            const DividerThemeData(color: Color(0xFF2E3138), space: 1),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: Color(0xFF1C1F26),
          selectedItemColor: primary,
          unselectedItemColor: Color(0xFF6B7280),
          type: BottomNavigationBarType.fixed,
          elevation: 8,
        ),
        textTheme: const TextTheme(
          titleLarge: TextStyle(
              color: Color(0xFFE8EAED),
              fontSize: 20,
              fontWeight: FontWeight.w700),
          titleMedium: TextStyle(
              color: Color(0xFFE8EAED),
              fontSize: 16,
              fontWeight: FontWeight.w600),
          titleSmall: TextStyle(
              color: Color(0xFFE8EAED),
              fontSize: 14,
              fontWeight: FontWeight.w600),
          bodyLarge: TextStyle(color: Color(0xFFE8EAED), fontSize: 16),
          bodyMedium: TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
          bodySmall: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
          labelLarge: TextStyle(
              color: Color(0xFFE8EAED),
              fontSize: 14,
              fontWeight: FontWeight.w600),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: const Color(0xFF2E3138),
          selectedColor: const Color(0xFF1E3A5F),
          labelStyle: const TextStyle(
              color: Color(0xFFE8EAED), fontWeight: FontWeight.w500),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      );
}
