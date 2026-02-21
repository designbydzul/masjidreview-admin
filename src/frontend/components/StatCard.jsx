import { Card, CardContent } from './ui/card';

export default function StatCard({ label, value, showBadge }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-text-2 text-xs font-semibold uppercase tracking-wider mb-2">{label}</div>
        <div className="flex items-center gap-2">
          <span className="font-heading text-[28px] font-bold text-text">{value ?? '–'}</span>
          {showBadge && value > 0 && (
            <span className="bg-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
