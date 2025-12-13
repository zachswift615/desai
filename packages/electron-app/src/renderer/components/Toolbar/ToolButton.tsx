import React from 'react';

interface ToolButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export function ToolButton({ icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 flex items-center justify-center rounded text-lg
        ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}
      `}
    >
      {icon}
    </button>
  );
}
