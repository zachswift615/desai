import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={
        <div className="h-full w-full flex items-center justify-center text-gray-500">
          Canvas Area
        </div>
      }
      layers={<div className="p-2 text-xs text-gray-400">Layers Panel</div>}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
