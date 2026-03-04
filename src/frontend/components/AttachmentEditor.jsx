import { useState, useRef } from 'react';
import { Plus, X, Paperclip, Link2, FileText, Image, Loader2 } from 'lucide-react';
import { uploadFile } from '../api';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

function getExt(url) {
  try { return url.split('?')[0].split('.').pop().toLowerCase(); } catch { return ''; }
}

function isImage(att) {
  if (att.type === 'url') return IMAGE_EXTS.some((e) => getExt(att.url) === e);
  return IMAGE_EXTS.some((e) => att.name?.toLowerCase().endsWith('.' + e));
}

export default function AttachmentEditor({ value = [], onChange, disabled }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  const atLimit = value.length >= MAX_ATTACHMENTS;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_FILE_SIZE) { showToast('Maks 5MB per file', 'error'); return; }
    if (atLimit) { showToast('Maks ' + MAX_ATTACHMENTS + ' lampiran', 'error'); return; }
    setUploading(true);
    try {
      const res = await uploadFile(file, 'feedback');
      onChange([...value, { type: 'file', url: res.url, name: file.name }]);
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (atLimit) { showToast('Maks ' + MAX_ATTACHMENTS + ' lampiran', 'error'); return; }
    onChange([...value, { type: 'url', url, name: url.split('/').pop() || url }]);
    setUrlDraft('');
    setShowUrlInput(false);
  };

  const handleRemove = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {/* Attachment list */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((att, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-border rounded-lg px-2.5 py-1.5 group">
              {isImage(att) ? (
                <img src={att.url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-text-3 shrink-0" />
              )}
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate flex-1 min-w-0"
              >
                {att.name || att.url}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-opacity shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-text-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* URL input row */}
      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } if (e.key === 'Escape') setShowUrlInput(false); }}
            placeholder="https://..."
            className="flex-1 h-8 px-2.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green"
            autoFocus
          />
          <button type="button" onClick={handleAddUrl} className="h-8 px-3 text-xs font-medium bg-green text-white rounded-lg hover:bg-green-dark transition-colors">
            Tambah
          </button>
          <button type="button" onClick={() => { setShowUrlInput(false); setUrlDraft(''); }} className="h-8 px-2 text-xs text-text-3 hover:text-text-1">
            Batal
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!disabled && !atLimit && !showUrlInput && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-2 border border-dashed border-border rounded-lg hover:border-green hover:text-green transition-colors',
              uploading && 'opacity-50 pointer-events-none'
            )}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-2 border border-dashed border-border rounded-lg hover:border-green hover:text-green transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" />
            Tempel URL
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
    </div>
  );
}
