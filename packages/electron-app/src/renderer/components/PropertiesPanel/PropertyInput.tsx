import React from 'react';

interface PropertyInputProps {
  label: string;
  value: string | number;
  type?: 'text' | 'number' | 'color';
  onChange: (value: string | number) => void;
}

export function PropertyInput({
  label,
  value,
  type = 'text',
  onChange,
}: PropertyInputProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent canvas from receiving this event and clearing selection
    e.stopPropagation();
  };

  return (
    <div className="flex items-center gap-2" onMouseDown={handleMouseDown}>
      <label className="text-xs text-gray-400 w-16">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(type === 'number' ? Number(e.target.value) : e.target.value)
        }
        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  );
}
