import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useMcpHandler } from './hooks/useMcpHandler';

export default function App() {
  useMcpHandler();

  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<PropertiesPanel />}
    />
  );
}
