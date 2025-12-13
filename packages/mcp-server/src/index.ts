#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'desai-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'desai_canvas_get_state',
        description: 'Get the current state of the canvas including all layers and elements',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'desai_canvas_screenshot',
        description: 'Capture a screenshot of the current canvas',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'desai_shape_rectangle',
        description: 'Create a rectangle on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            width: { type: 'number', description: 'Width' },
            height: { type: 'number', description: 'Height' },
            fill: { type: 'string', description: 'Fill color (hex)' },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width' },
            cornerRadius: { type: 'number', description: 'Corner radius' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      {
        name: 'desai_text_create',
        description: 'Create a text element on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            content: { type: 'string', description: 'Text content' },
            fontSize: { type: 'number', description: 'Font size' },
            fill: { type: 'string', description: 'Text color (hex)' },
          },
          required: ['x', 'y', 'content'],
        },
      },
      {
        name: 'desai_element_delete',
        description: 'Delete an element from the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the element to delete' },
          },
          required: ['elementId'],
        },
      },
    ],
  };
});

// Handle tool calls (placeholder - will connect to Electron via IPC)
server.setRequestHandler(CallToolRequestSchema, async (_request) => {
  // For now, return a placeholder response
  // This will be replaced with IPC communication to Electron
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Not connected to Desai app. Please ensure the app is running.',
        }),
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Desai MCP Server running on stdio');
}

main().catch(console.error);
