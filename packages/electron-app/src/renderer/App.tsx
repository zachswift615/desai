import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<div className="p-2 text-xs text-gray-400">Properties</div>}
    />
  );
}
