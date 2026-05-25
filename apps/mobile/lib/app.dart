import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

class FleetOpsApp extends StatelessWidget {
  const FleetOpsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FleetOps',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1565C0)),
        useMaterial3: true,
      ),
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) =>
            auth.isAuthenticated ? const HomeScreen() : const LoginScreen(),
      ),
    );
  }
}
