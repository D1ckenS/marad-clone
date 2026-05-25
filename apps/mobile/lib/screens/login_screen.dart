import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiUrlCtrl = TextEditingController(text: 'http://192.168.1.1:3001');
  final _tenantCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  bool _showApiUrl = false;

  @override
  void dispose() {
    _apiUrlCtrl.dispose();
    _tenantCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _loading = true);
    try {
      await context.read<AuthProvider>().login(
            baseUrl: _apiUrlCtrl.text.trim(),
            tenantId: _tenantCtrl.text.trim(),
            email: _emailCtrl.text.trim(),
            password: _passwordCtrl.text,
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('barcode_scan.connection_error'.tr(namedArgs: {'error': '$e'})), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.directions_boat, size: 72, color: Color(0xFF1565C0)),
                  const SizedBox(height: 8),
                  Text(
                    'FleetOps',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1565C0),
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'app.tagline'.tr(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _tenantCtrl,
                    decoration: InputDecoration(
                      labelText: 'auth.tenant_id'.tr(),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.business),
                    ),
                    textInputAction: TextInputAction.next,
                    validator: (v) => (v?.trim().isEmpty ?? true) ? '!' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailCtrl,
                    decoration: InputDecoration(
                      labelText: 'auth.email'.tr(),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.email_outlined),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    validator: (v) => (v?.trim().isEmpty ?? true) ? '!' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordCtrl,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'auth.password'.tr(),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _login(),
                    validator: (v) => (v?.isEmpty ?? true) ? '!' : null,
                  ),
                  const SizedBox(height: 8),
                  // Advanced: vessel API URL toggle
                  TextButton.icon(
                    onPressed: () => setState(() => _showApiUrl = !_showApiUrl),
                    icon: Icon(_showApiUrl ? Icons.expand_less : Icons.expand_more, size: 16),
                    label: Text(
                      'auth.advanced'.tr(),
                      style: const TextStyle(fontSize: 12),
                    ),
                    style: TextButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                  if (_showApiUrl) ...[
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _apiUrlCtrl,
                      decoration: InputDecoration(
                        labelText: 'auth.vessel_api_url'.tr(),
                        hintText: 'http://192.168.1.1:3001',
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.wifi),
                      ),
                      keyboardType: TextInputType.url,
                      validator: (v) =>
                          (v?.trim().isEmpty ?? true) ? '!' : null,
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _loading ? null : _login,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : Text('auth.sign_in'.tr()),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
