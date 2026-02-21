export default function Logo({ showBadge = true }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-xl">
        <span className="font-normal text-text-2">Masjid</span>
        <span className="font-bold text-dark-green">Review</span>
      </span>
      {showBadge && (
        <span className="bg-green text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Admin
        </span>
      )}
    </div>
  );
}
