import React from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useMcpHandler } from './hooks/useMcpHandler';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useMcpHandler();
  useKeyboardShortcuts();

  return (
    <Layout
      toolbar={<Toolbar />}
      canvas={<Canvas />}
      layers={<LayersPanel />}
      properties={<PropertiesPanel />}
    />
  );
}
