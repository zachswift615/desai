#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { connectToElectron, sendCommand, isConnected } from './ipc-client.js';
import type { IpcMessage } from '@desai/shared';

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
      // Canvas operations
      {
        name: 'desai_canvas_create',
        description: 'Create a new canvas with specified dimensions',
        inputSchema: {
          type: 'object',
          properties: {
            width: { type: 'number', description: 'Canvas width in pixels', default: 1920 },
            height: { type: 'number', description: 'Canvas height in pixels', default: 1080 },
            background: { type: 'string', description: 'Background color (hex)', default: '#ffffff' },
          },
        },
      },
      {
        name: 'desai_canvas_get_state',
        description: 'Get the current state of the canvas including all layers and elements',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'desai_canvas_screenshot',
        description: 'Capture a screenshot of the current canvas. Returns a file path to the PNG image.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'desai_canvas_clear',
        description: 'Clear all elements from the canvas',
        inputSchema: { type: 'object', properties: {} },
      },

      // Layer operations
      {
        name: 'desai_layer_create',
        description: 'Create a new layer',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Layer name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'desai_layer_delete',
        description: 'Delete a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'ID of the layer to delete' },
          },
          required: ['layerId'],
        },
      },
      {
        name: 'desai_layer_set_visibility',
        description: 'Show or hide a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            visible: { type: 'boolean', description: 'Whether layer is visible' },
          },
          required: ['layerId', 'visible'],
        },
      },
      {
        name: 'desai_layer_set_opacity',
        description: 'Set layer opacity (0-100)',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            opacity: { type: 'number', description: 'Opacity 0-100' },
          },
          required: ['layerId', 'opacity'],
        },
      },
      {
        name: 'desai_layer_lock',
        description: 'Lock or unlock a layer',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'Layer ID' },
            locked: { type: 'boolean', description: 'Whether layer is locked' },
          },
          required: ['layerId', 'locked'],
        },
      },

      // Shape creation
      {
        name: 'desai_shape_rectangle',
        description: 'Create a rectangle on the canvas. Supports solid colors or linear gradients.',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            width: { type: 'number', description: 'Width' },
            height: { type: 'number', description: 'Height' },
            fill: {
              oneOf: [
                { type: 'string', description: 'Solid fill color (hex)' },
                {
                  type: 'object',
                  description: 'Linear gradient',
                  properties: {
                    type: { type: 'string', enum: ['linear'] },
                    angle: { type: 'number', description: 'Gradient angle in degrees (0=left-to-right, 90=top-to-bottom, 180=right-to-left)' },
                    stops: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          color: { type: 'string', description: 'Stop color (hex)' },
                          position: { type: 'number', description: 'Stop position (0-100)' }
                        },
                        required: ['color', 'position']
                      }
                    }
                  },
                  required: ['type', 'angle', 'stops']
                }
              ],
              default: '#3b82f6'
            },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width', default: 0 },
            cornerRadius: { type: 'number', description: 'Corner radius', default: 0 },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      {
        name: 'desai_shape_ellipse',
        description: 'Create an ellipse on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position (center)' },
            y: { type: 'number', description: 'Y position (center)' },
            width: { type: 'number', description: 'Width (diameter)' },
            height: { type: 'number', description: 'Height (diameter)' },
            fill: { type: 'string', description: 'Fill color (hex)', default: '#10b981' },
            stroke: { type: 'string', description: 'Stroke color (hex)' },
            strokeWidth: { type: 'number', description: 'Stroke width', default: 0 },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },

      // Text
      {
        name: 'desai_text_create',
        description: 'Create a text element on the canvas',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position' },
            y: { type: 'number', description: 'Y position' },
            width: { type: 'number', description: 'Text box width', default: 400 },
            height: { type: 'number', description: 'Text box height', default: 100 },
            content: { type: 'string', description: 'Text content' },
            fontSize: { type: 'number', description: 'Font size in pixels', default: 24 },
            fontFamily: { type: 'string', description: 'Font family', default: 'system-ui' },
            fontWeight: { type: 'string', description: 'Font weight (normal, bold, 100-900)', default: 'normal' },
            fill: { type: 'string', description: 'Text color (hex)', default: '#000000' },
            align: { type: 'string', enum: ['left', 'center', 'right'], default: 'left' },
            shadow: {
              type: 'object',
              description: 'Text shadow',
              properties: {
                x: { type: 'number', description: 'Horizontal offset' },
                y: { type: 'number', description: 'Vertical offset' },
                blur: { type: 'number', description: 'Blur radius' },
                color: { type: 'string', description: 'Shadow color (hex or rgba)' },
              },
            },
          },
          required: ['x', 'y', 'content'],
        },
      },
      {
        name: 'desai_text_update',
        description: 'Update an existing text element',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the text element' },
            content: { type: 'string', description: 'New text content' },
            fontSize: { type: 'number', description: 'New font size' },
            fill: { type: 'string', description: 'New text color' },
          },
          required: ['elementId'],
        },
      },

      // Element manipulation
      {
        name: 'desai_element_transform',
        description: 'Transform an element (move, resize, rotate)',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'Element ID' },
            x: { type: 'number', description: 'New X position' },
            y: { type: 'number', description: 'New Y position' },
            width: { type: 'number', description: 'New width' },
            height: { type: 'number', description: 'New height' },
            rotation: { type: 'number', description: 'Rotation in degrees' },
          },
          required: ['elementId'],
        },
      },
      {
        name: 'desai_element_style',
        description: 'Update element style (fill, stroke, opacity)',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'Element ID' },
            fill: { type: 'string', description: 'Fill color' },
            stroke: { type: 'string', description: 'Stroke color' },
            strokeWidth: { type: 'number', description: 'Stroke width' },
            opacity: { type: 'number', description: 'Opacity 0-100' },
          },
          required: ['elementId'],
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
      {
        name: 'desai_element_duplicate',
        description: 'Duplicate an element',
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'ID of the element to duplicate' },
          },
          required: ['elementId'],
        },
      },

      // Export
      {
        name: 'desai_export_png',
        description: 'Export the current canvas as a PNG file. Opens save dialog for user to choose location.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!isConnected()) {
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
  }

  let message: IpcMessage;

  switch (name) {
    case 'desai_canvas_create':
      message = {
        type: 'canvas:create',
        payload: {
          width: (args as any)?.width ?? 1920,
          height: (args as any)?.height ?? 1080,
          background: (args as any)?.background ?? '#ffffff',
        },
      };
      break;

    case 'desai_canvas_get_state':
      message = { type: 'canvas:get-state', payload: null };
      break;

    case 'desai_canvas_screenshot':
      message = { type: 'canvas:screenshot', payload: null };
      break;

    case 'desai_canvas_clear':
      message = { type: 'canvas:clear', payload: null };
      break;

    case 'desai_layer_create':
      message = { type: 'layer:create', payload: { name: (args as any).name } };
      break;

    case 'desai_layer_delete':
      message = { type: 'layer:delete', payload: { layerId: (args as any).layerId } };
      break;

    case 'desai_layer_set_visibility':
      message = {
        type: 'layer:set-visibility',
        payload: { layerId: (args as any).layerId, visible: (args as any).visible },
      };
      break;

    case 'desai_layer_set_opacity':
      message = {
        type: 'layer:set-opacity',
        payload: { layerId: (args as any).layerId, opacity: (args as any).opacity },
      };
      break;

    case 'desai_layer_lock':
      message = {
        type: 'layer:lock',
        payload: { layerId: (args as any).layerId, locked: (args as any).locked },
      };
      break;

    case 'desai_shape_rectangle':
      message = { type: 'shape:rectangle', payload: args as any };
      break;

    case 'desai_shape_ellipse':
      message = { type: 'shape:ellipse', payload: args as any };
      break;

    case 'desai_text_create':
      message = { type: 'text:create', payload: args as any };
      break;

    case 'desai_text_update':
      message = {
        type: 'text:update',
        payload: { elementId: (args as any).elementId, updates: args as any },
      };
      break;

    case 'desai_element_transform':
      message = {
        type: 'element:transform',
        payload: { elementId: (args as any).elementId, transform: args as any },
      };
      break;

    case 'desai_element_style':
      message = {
        type: 'element:style',
        payload: { elementId: (args as any).elementId, style: args as any },
      };
      break;

    case 'desai_element_delete':
      message = { type: 'element:delete', payload: { elementId: (args as any).elementId } };
      break;

    case 'desai_element_duplicate':
      message = { type: 'element:duplicate', payload: { elementId: (args as any).elementId } };
      break;

    case 'desai_export_png':
      message = { type: 'export:png', payload: {} };
      break;

    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }],
      };
  }

  try {
    const response = await sendCommand(message);
    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: String(error) }) }],
    };
  }
});

async function main() {
  // Try to connect to Electron app
  try {
    await connectToElectron();
  } catch (error) {
    console.error('Warning: Could not connect to Desai app:', error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Desai MCP Server running on stdio');
}

main().catch(console.error);
