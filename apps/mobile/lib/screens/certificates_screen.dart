import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class CertificatesScreen extends StatefulWidget {
  const CertificatesScreen({super.key});
  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  List<dynamic> _certs = [];
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
      final url = _expiringOnly ? '/certificates?expiringWithinDays=90' : '/certificates';
      final data = await client.get(url);
      setState(() { _certs = data as List<dynamic>; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Color _statusColor(Map<String, dynamic> cert) {
    final expiresAt = cert['expiresAt'] as String?;
    if (expiresAt == null) return Colors.grey;
    final exp = DateTime.tryParse(expiresAt);
    if (exp == null) return Colors.grey;
    final days = exp.difference(DateTime.now()).inDays;
    if (days < 0) return const Color(0xFFAB382E);
    if (days < 30) return const Color(0xFFB5731E);
    if (days < 90) return const Color(0xFF1F5B9D);
    return const Color(0xFF2F7D4F);
  }

  String _expiryLabel(Map<String, dynamic> cert) {
    final expiresAt = cert['expiresAt'] as String?;
    if (expiresAt == null) return 'No expiry';
    final exp = DateTime.tryParse(expiresAt);
    if (exp == null) return expiresAt;
    final days = exp.difference(DateTime.now()).inDays;
    if (days < 0) return 'EXPIRED ${-days}d ago';
    if (days == 0) return 'Expires TODAY';
    return 'Expires in ${days}d';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Certificates'),
        actions: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Expiring', style: TextStyle(fontSize: 12)),
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
                    ? const Center(child: Text('No certificates found.'))
                    : ListView.builder(
                        itemCount: _certs.length,
                        itemBuilder: (ctx, i) {
                          final c = _certs[i] as Map<String, dynamic>;
                          final color = _statusColor(c);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: Icon(Icons.verified_outlined, color: color),
                              title: Text(
                                c['certificateType']?['name']?.toString() ?? 'Certificate',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${c['subjectType']} · #${c['number'] ?? '—'}'),
                                  Text(_expiryLabel(c),
                                      style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
                                ],
                              ),
                              isThreeLine: true,
                              trailing: c['issuedBy'] != null
                                  ? Text(c['issuedBy'].toString(),
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
