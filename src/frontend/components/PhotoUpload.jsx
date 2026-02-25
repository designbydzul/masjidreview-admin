import { useRef, useState } from 'react';
import { Camera, CheckCircle, XCircle } from 'lucide-react';
import { uploadFile } from '../api';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function PhotoUpload({ value, onChange, prefix = 'masjid', resolveUrl }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus({ type: 'loading', message: 'Mengupload...' });
    try {
      const data = await uploadFile(file, prefix);
      onChange(data.url);
      setStatus({ type: 'success', message: 'Uploaded' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Gagal: ' + err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL foto..."
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="whitespace-nowrap"
        >
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Upload
        </Button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>
      {status && (
        <span className="text-xs text-text-3 flex items-center gap-1">
          {status.type === 'success' && <CheckCircle className="h-3 w-3 text-green" />}
          {status.type === 'error' && <XCircle className="h-3 w-3 text-red" />}
          {status.message}
        </span>
      )}
      {value && (
        <img
          src={resolveUrl ? resolveUrl(value) : value}
          alt="Preview"
          className="w-20 h-20 object-cover rounded-sm border border-border"
        />
      )}
    </div>
  );
}
