import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class AppearanceScreen extends StatefulWidget {
  const AppearanceScreen({super.key});

  @override
  State<AppearanceScreen> createState() => _AppearanceScreenState();
}

class _AppearanceScreenState extends State<AppearanceScreen> {
  String _theme = 'system';
  double _fontSize = 1.0; // scale factor

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Theme',
              style: Theme.of(context).textTheme.titleSmall),
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
                  groupValue: _theme,
                  // ignore: deprecated_member_use
                  onChanged: (v) => setState(() => _theme = v!),
                  activeColor: AppTheme.primary,
                ),
                onTap: () => setState(() => _theme = t.$1),
              ))),
          const SizedBox(height: 20),
          Text('Text Size',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Slider(
            value: _fontSize,
            min: 0.8,
            max: 1.4,
            divisions: 6,
            label: _scaleName(_fontSize),
            activeColor: AppTheme.primary,
            onChanged: (v) => setState(() => _fontSize = v),
          ),
          Center(
            child: Text(
              'Preview text at ${_scaleName(_fontSize)}',
              style: TextStyle(fontSize: 14 * _fontSize),
            ),
          ),
        ],
      ),
    );
  }

  String _scaleName(double v) {
    if (v <= 0.8) return 'Smallest';
    if (v <= 0.9) return 'Small';
    if (v <= 1.05) return 'Default';
    if (v <= 1.2) return 'Large';
    if (v <= 1.3) return 'Larger';
    return 'Largest';
  }
}
