import { Switch } from './ui/switch';

export default function ToggleSwitch({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
}
