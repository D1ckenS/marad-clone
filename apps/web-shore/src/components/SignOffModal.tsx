import { useRef, useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SignOffModalProps {
  jobInstanceId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignOffModal({ jobInstanceId, onClose, onSuccess }: SignOffModalProps) {
  const [hoursWorked, setHoursWorked] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setHoursWorked('');
    setNotes('');
    setPhotos([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotos(Array.from(e.target.files ?? []));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobInstanceId) return;
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      if (hoursWorked) form.append('hoursWorked', hoursWorked);
      if (notes) form.append('notes', notes);
      for (const photo of photos) form.append('photos', photo);

      await api.postForm(`/job-instances/${jobInstanceId}/sign-off`, form);
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-off failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={jobInstanceId !== null}
      title="Sign Off Job"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="sign-off-form" loading={loading}>
            Sign Off
          </Button>
        </>
      }
    >
      <form id="sign-off-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="hoursWorked"
          label="Hours worked"
          type="number"
          min="0"
          step="0.5"
          placeholder="e.g. 2.5"
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value)}
        />
        <TextArea
          id="notes"
          label="Notes"
          placeholder="Observations, parts used, findings…"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Photos</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 border border-dashed border-slate-300 rounded-md px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            📷{' '}
            {photos.length > 0
              ? `${photos.length} file(s) selected`
              : 'Add photos (up to 10, 8 MB each)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
      </form>
    </Modal>
  );
}
