import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'providers/auth_provider.dart';
import 'services/api_client.dart';

/// All 8 supported locales (mirrors apps/web-shore/src/locales/*.json).
/// Arabic is included to exercise RTL.
const supportedLocales = <Locale>[
  Locale('en'),
  Locale('de'),
  Locale('nl'),
  Locale('tl'),
  Locale('ru'),
  Locale('el'),
  Locale('zh'),
  Locale('ar'),
];

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  final apiClient = ApiClient();
  final authProvider = AuthProvider(apiClient);
  await authProvider.init(); // restore token + base URL from secure storage

  runApp(
    EasyLocalization(
      supportedLocales: supportedLocales,
      path: 'assets/locales',
      fallbackLocale: const Locale('en'),
      child: MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: apiClient),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: const FleetOpsApp(),
      ),
    ),
  );
}
