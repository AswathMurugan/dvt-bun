import { handleExecute } from './routes/execute';
import { handleExecuteWithSys } from './routes/execute-with-sys';
import type { ApiResponse } from './types';

/**
 * JavaScript Executor API Server
 * 
 * Provides secure JavaScript code execution using VM2 sandbox.
 * Supports HTTP requests, async functions, and bundled code.
 */
const server = Bun.serve({
  port: 3000,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (req.method === 'POST' && url.pathname === '/execute') {
      return await handleExecute(req);
    }

    if (req.method === 'POST' && url.pathname === '/execute-with-sys') {
      return await handleExecuteWithSys(req);
    }

    if (req.method === 'GET' && url.pathname === '/') {
      const response: ApiResponse = { 
        message: 'JavaScript Executor API',
        endpoints: {
          'POST /execute': 'Execute JavaScript function with parameters',
          'POST /execute-with-sys': 'Execute JavaScript function with automatic system variable injection'
        },
        usage: {
          format: {
            code: 'JavaScript code with function definition',
            input: 'Array of parameters to pass to the function',
            functionName: 'Name of the function to call'
          },
          example: {
            code: 'async function main(a, b) { return a + b; }',
            input: [5, 10],
            functionName: 'main'
          }
        }
      };
      
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
});

console.log(`Server running on http://localhost:${server.port}`);