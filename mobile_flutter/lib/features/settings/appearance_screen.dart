import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/theme_provider.dart';
import '../../../core/theme/app_theme.dart';

class AppearanceScreen extends StatefulWidget {
  const AppearanceScreen({super.key});

  @override
  State<AppearanceScreen> createState() => _AppearanceScreenState();
}

class _AppearanceScreenState extends State<AppearanceScreen> {
  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final currentTheme = themeProvider.themeName;

    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Theme', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          ...([
            ('system', 'System default', Icons.brightness_auto_outlined),
            ('light', 'Light', Icons.light_mode_outlined),
            ('dark', 'Dark', Icons.dark_mode_outlined),
          ].map((t) => ListTile(
                leading: Icon(t.$3),
                title: Text(t.$2),
                trailing: Radio<String>(
                  value: t.$1,
                  // ignore: deprecated_member_use
                  groupValue: currentTheme,
                  // ignore: deprecated_member_use
                  onChanged: (v) {
                    if (v != null) context.read<ThemeProvider>().setTheme(v);
                  },
                  activeColor: AppTheme.primary,
                ),
                onTap: () => context.read<ThemeProvider>().setTheme(t.$1),
              ))),
        ],
      ),
    );
  }
}
