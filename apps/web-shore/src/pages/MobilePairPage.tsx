// H15 — Mobile QR-pairing page. Vessel operators open this page on the
// laptop running the FleetOps desktop SPA and have the crew scan the QR
// with their phones to populate baseUrl + tenantId in one go (replacing
// the previous "enter laptop's LAN IP by hand" flow that was the entry
// point pain in `mobile_fixes.md` §3d).
//
// The QR encodes a small JSON envelope. The `kind` field guards mobile
// against accidentally interpreting any random JSON-shaped QR as a
// pairing payload; the `v` field gives us room to grow the schema
// without breaking older mobile builds.

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@fleetops/ui-kit';
import { useAuth } from '../context/useAuth.js';

interface PairingPayload {
  v: 1;
  kind: 'fleetops-vessel-pairing';
  baseUrl: string;
  tenantId: string;
}

/**
 * Build the pairing JSON. Exported for testing — the mobile-side parser
 * lives in `apps/mobile/lib/services/pairing_payload.dart` and must stay
 * in sync with this shape.
 */
export function buildPairingPayload(baseUrl: string, tenantId: string): PairingPayload {
  return { v: 1, kind: 'fleetops-vessel-pairing', baseUrl, tenantId };
}

/**
 * Best-effort guess at the vessel api LAN URL by replacing the current
 * page's port with the conventional api-vessel port (3001). The user
 * can override before generating the QR.
 *
 * Returns an empty string when run outside a browser (SSR / test).
 */
export function guessVesselApiUrl(origin: string | undefined): string {
  if (!origin) return '';
  try {
    const url = new URL(origin);
    url.port = '3001';
    // Strip trailing slash for consistency
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function MobilePairPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const defaultBaseUrl = useMemo(
    () => guessVesselApiUrl(typeof window !== 'undefined' ? window.location.origin : undefined),
    [],
  );

  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [tenantId, setTenantId] = useState(user?.tenantId ?? '');

  useEffect(() => {
    if (user?.tenantId && tenantId === '') {
      setTenantId(user.tenantId);
    }
  }, [user?.tenantId, tenantId]);

  const trimmedBase = baseUrl.trim();
  const trimmedTenant = tenantId.trim();
  const isValid =
    trimmedBase.length > 0 && /^https?:\/\//i.test(trimmedBase) && trimmedTenant.length > 0;

  const payloadJson = isValid
    ? JSON.stringify(buildPairingPayload(trimmedBase, trimmedTenant))
    : '';

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-bold">{t('mobile_pair.title')}</h1>
      <p className="mb-6 text-sm text-gray-600">{t('mobile_pair.subtitle')}</p>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="pair-base-url" className="mb-1 block text-sm font-medium text-gray-700">
            {t('mobile_pair.base_url_label')}
          </label>
          <Input
            id="pair-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.1.5:3001"
          />
          <p className="mt-1 text-xs text-gray-500">{t('mobile_pair.base_url_hint')}</p>
        </div>

        <div>
          <label htmlFor="pair-tenant-id" className="mb-1 block text-sm font-medium text-gray-700">
            {t('mobile_pair.tenant_id_label')}
          </label>
          <Input
            id="pair-tenant-id"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="01ABC..."
          />
        </div>

        <div className="flex justify-center pt-4">
          {isValid ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-lg bg-white p-4 shadow-md ring-1 ring-gray-200"
                data-testid="pairing-qr"
                data-payload={payloadJson}
              >
                <QRCodeSVG value={payloadJson} size={256} level="M" includeMargin={false} />
              </div>
              <p className="max-w-sm text-center text-sm text-gray-600">
                {t('mobile_pair.scan_instructions')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              {t('mobile_pair.fill_fields_first')}
            </div>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer select-none font-medium">
              {t('mobile_pair.manual_entry_summary')}
            </summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>
                <span className="text-gray-500">baseUrl:</span> {trimmedBase || '—'}
              </div>
              <div>
                <span className="text-gray-500">tenantId:</span> {trimmedTenant || '—'}
              </div>
            </div>
          </details>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              setBaseUrl(defaultBaseUrl);
              setTenantId(user?.tenantId ?? '');
            }}
          >
            {t('mobile_pair.reset_button')}
          </Button>
        </div>
      </div>
    </div>
  );
}
