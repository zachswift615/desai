import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';

export default function App() {
  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<PropertiesPanel />}
    />
  );
}
