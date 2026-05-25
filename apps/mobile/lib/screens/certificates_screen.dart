import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/certificate.dart';
import '../providers/auth_provider.dart';

/// Keeps certs whose `expiresAt` is within [withinDays] from [now] (inclusive),
/// including already-expired ones (negative remaining days). Certs without an
/// expiry date are dropped — by definition they can't be "expiring soon."
///
/// Lives at top level (not as a private static on the State) so it's reachable
/// from the unit test in `test/cert_filters_test.dart`.
List<Certificate> filterCertsExpiringWithin(
  List<Certificate> certs,
  int withinDays, {
  DateTime? now,
}) {
  final ref = now ?? DateTime.now();
  return certs.where((c) {
    final days = c.daysUntilExpiry(now: ref);
    if (days == null) return false;
    return days <= withinDays;
  }).toList();
}

class CertificatesScreen extends StatefulWidget {
  const CertificatesScreen({super.key});
  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  List<Certificate> _certs = [];
  bool _loading = true;
  String? _error;
  bool _expiringOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = context.read<AuthProvider>().client;
      // Vessel /certificates ignores ?expiringWithinDays (shore supports it,
      // vessel doesn't). Always fetch all and filter client-side instead —
      // dataset is small (cert count per vessel is in the dozens, not millions).
      final data = await client.get('/certificates');
      final all = (data as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(Certificate.fromJson)
          .toList();
      setState(() {
        _certs = _expiringOnly ? filterCertsExpiringWithin(all, 90) : all;
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Color _statusColor(Certificate cert) {
    final days = cert.daysUntilExpiry();
    if (days == null) return Colors.grey;
    if (days < 0) return const Color(0xFFAB382E);
    if (days < 30) return const Color(0xFFB5731E);
    if (days < 90) return const Color(0xFF1F5B9D);
    return const Color(0xFF2F7D4F);
  }

  String _expiryLabel(Certificate cert) {
    final days = cert.daysUntilExpiry();
    if (days == null) return 'certificates.no_expiry'.tr();
    if (days < 0) return 'certificates.expired_ago'.tr(namedArgs: {'days': '${-days}'});
    if (days == 0) return 'certificates.expires_today'.tr();
    return 'certificates.expires_in'.tr(namedArgs: {'days': '$days'});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('certificates.title'.tr()),
        actions: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('certificates.expiring_switch'.tr(), style: const TextStyle(fontSize: 12)),
              Switch(
                value: _expiringOnly,
                onChanged: (v) { setState(() { _expiringOnly = v; }); _load(); },
              ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _certs.isEmpty
                    ? Center(child: Text('certificates.empty'.tr()))
                    : ListView.builder(
                        itemCount: _certs.length,
                        itemBuilder: (ctx, i) {
                          final c = _certs[i];
                          final color = _statusColor(c);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: Icon(Icons.verified_outlined, color: color),
                              title: Text(
                                c.certificateType?.name ?? 'Certificate',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${c.subjectType ?? '—'} · #${c.number ?? '—'}'),
                                  Text(_expiryLabel(c),
                                      style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
                                ],
                              ),
                              isThreeLine: true,
                              trailing: c.issuedBy != null
                                  ? Text(c.issuedBy!,
                                      style: const TextStyle(fontSize: 11, color: Colors.grey))
                                  : null,
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
