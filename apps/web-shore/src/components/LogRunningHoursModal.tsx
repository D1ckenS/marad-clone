import { useState } from 'react';
import { Button, Input, Modal } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  componentId: string;
  componentName: string;
  currentHours: string;
  onClose: () => void;
  onLogged: () => void;
}

const SOURCES = ['MANUAL', 'AUTOMATIC', 'ESTIMATED'] as const;

export function LogRunningHoursModal({
  open,
  componentId,
  componentName,
  currentHours,
  onClose,
  onLogged,
}: Props) {
  const [value, setValue] = useState('');
  const [source, setSource] = useState<(typeof SOURCES)[number]>('MANUAL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setValue('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const num = parseFloat(value);
    if (!value || isNaN(num)) {
      setError('Enter a valid number.');
      return;
    }
    if (num <= parseFloat(currentHours)) {
      setError(`Must be greater than the current value (${currentHours} h).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/running-hour-readings', {
        componentId,
        value,
        source,
        recordedAt: new Date().toISOString(),
      });
      setValue('');
      onLogged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log reading.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Log Running Hours — ${componentName}`}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Log Reading
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-md">
          Current: <span className="font-mono font-medium">{currentHours} h</span>
          {' — '}new reading must be higher.
        </div>
        <Input
          id="rh-value"
          label="New running hours total *"
          type="number"
          min={currentHours}
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`> ${currentHours}`}
          autoFocus
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
            {SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`flex-1 py-1.5 px-2 transition-colors capitalize ${
                  source === s
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          If any jobs on this component have running-hour intervals, instances will be auto-created
          for each threshold crossed.
        </p>
      </div>
    </Modal>
  );
}
