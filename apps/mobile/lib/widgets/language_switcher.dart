import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

/// AppBar action: lets the user pick from the 8 supported locales.
/// Persists the choice via easy_localization's built-in SharedPreferences cache.
class LanguageSwitcher extends StatelessWidget {
  const LanguageSwitcher({super.key});

  static const _labels = <String, String>{
    'en': 'English',
    'de': 'Deutsch',
    'nl': 'Nederlands',
    'tl': 'Filipino',
    'ru': 'Русский',
    'el': 'Ελληνικά',
    'zh': '中文',
    'ar': 'العربية',
  };

  @override
  Widget build(BuildContext context) {
    final current = context.locale.languageCode;
    return PopupMenuButton<Locale>(
      tooltip: 'common.language'.tr(),
      icon: const Icon(Icons.language),
      initialValue: context.locale,
      onSelected: (loc) => context.setLocale(loc),
      itemBuilder: (_) => [
        for (final loc in context.supportedLocales)
          PopupMenuItem<Locale>(
            value: loc,
            child: Row(
              children: [
                if (loc.languageCode == current)
                  const Icon(Icons.check, size: 16)
                else
                  const SizedBox(width: 16),
                const SizedBox(width: 8),
                Text(_labels[loc.languageCode] ?? loc.languageCode),
              ],
            ),
          ),
      ],
    );
  }
}
