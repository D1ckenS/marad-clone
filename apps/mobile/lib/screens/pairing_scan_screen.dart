// H15 — QR pairing scanner. Separate from BarcodeScanScreen because:
//   * it doesn't hit the API at all (pure client-side parse)
//   * it returns a PairingPayload, not a BarcodeScanResult
//   * it filters to QR-shaped codes (the vessel SPA renders a QR; we
//     don't want a stray inventory barcode to populate the login form)
//
// The parser is `parsePairingPayload` in services/pairing_payload.dart.
// On a malformed scan we keep the scanner running so the operator can
// retry instead of dropping back to the login screen.

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/pairing_payload.dart';

class PairingScanScreen extends StatefulWidget {
  const PairingScanScreen({super.key});

  @override
  State<PairingScanScreen> createState() => _PairingScanScreenState();
}

class _PairingScanScreenState extends State<PairingScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool _processing = false;
  bool _torchOn = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    final value = barcodes.first.rawValue;
    if (value == null) return;

    setState(() => _processing = true);
    await _controller.stop();

    final payload = parsePairingPayload(value);
    if (!mounted) return;

    if (payload != null) {
      Navigator.of(context).pop<PairingPayload>(payload);
      return;
    }

    // Not a pairing QR — show snackbar, resume the scanner.
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('pairing_scan.invalid_qr'.tr())),
    );
    setState(() => _processing = false);
    await _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('pairing_scan.title'.tr()),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            tooltip: 'pairing_scan.toggle_torch'.tr(),
            onPressed: () {
              _controller.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios_outlined),
            tooltip: 'pairing_scan.switch_camera'.tr(),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          if (_processing)
            ColoredBox(
              color: Colors.black45,
              child: Center(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 12),
                        Text('pairing_scan.reading'.tr()),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'pairing_scan.hint'.tr(),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
