import { useState } from 'react';

export default function ExpandableText({ text, maxLen = 100 }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return <span className="text-text-3">-</span>;
  if (text.length <= maxLen) return <span className="text-text-2">{text}</span>;

  return (
    <span className="text-text-2">
      {expanded ? text : text.slice(0, maxLen) + '... '}
      <span
        className="text-green cursor-pointer hover:underline text-xs font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        {expanded ? ' Sembunyikan' : 'Selengkapnya'}
      </span>
    </span>
  );
}
