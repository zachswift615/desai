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
      {
        name: 'desai',
        description: `Design canvas tool. Pass array of ops to execute sequentially.

Op format: {target, op, ...params}

canvas: create(width?,height?,bg?), get_state, screenshot, clear
layer: create(name), delete(id), visibility(id,visible), opacity(id,val), lock(id,locked)
shape: rect(x,y,w,h,fill?,stroke?,radius?), ellipse(x,y,w,h,fill?,stroke?)
text: create(x,y,content,fontSize?,fontWeight?,fill?,shadow?), update(id,content?,fontSize?,fill?)
element: transform(id,x?,y?,w?,h?,rotation?), style(id,fill?,stroke?,opacity?), delete(id), duplicate(id)
image: add(path,x?,y?,w?,h?)
export: png

Returns: [{success,data?,error?}] per op`,
        inputSchema: {
          type: 'object',
          properties: {
            ops: {
              type: 'array',
              items: { type: 'object' },
              description: 'Operations to execute: [{target,op,...params}]',
            },
          },
          required: ['ops'],
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

  if (name !== 'desai') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }],
    };
  }

  // Forward to batch:execute
  const message: IpcMessage = {
    type: 'batch:execute',
    payload: { ops: (args as any).ops },
  };

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
