import { Check, X } from 'lucide-react';
import { Button } from './ui/button';

export default function BulkBar({ count, onApprove, onReject }) {
  if (!count) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-emerald-50 border border-emerald-200 rounded-sm">
      <span className="text-sm font-medium text-green">{count} dipilih</span>
      <div className="flex gap-2 ml-auto">
        <Button size="sm" onClick={onApprove} className="font-semibold">
          <Check className="h-3.5 w-3.5 mr-1" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} className="font-semibold hover:border-red hover:text-red">
          <X className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  );
}
