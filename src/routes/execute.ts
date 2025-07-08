import { executeJavaScript } from '../services/jsExecutor';
import { getIAMToken } from '../utils/iam-token-utils';
import type { ExecuteRequest, ExecuteResponse } from '../types';

/**
 * Handles POST /execute endpoint requests.
 * Validates request body and executes JavaScript code in sandbox.
 * Returns direct function result with execution time in headers.
 * 
 * @param req - HTTP request object
 * @returns HTTP response with execution result or error
 */
export async function handleExecute(req: Request): Promise<Response> {
  try {
    // Extract Jiffy-specific headers
    const jiffyHeaders = {
      tenantId: req.headers.get('x-jiffy-tenant-id'),
      appId: req.headers.get('x-jiffy-app-id'),
      userId: req.headers.get('x-jiffy-user-id'),
      requestId: req.headers.get('x-request-id') || 'unknown'
    };

    // Log incoming request headers
    console.log('[API] Request received:', {
      tenantId: jiffyHeaders.tenantId || 'not-provided',
      appId: jiffyHeaders.appId || 'not-provided', 
      userId: jiffyHeaders.userId || 'not-provided',
      requestId: jiffyHeaders.requestId,
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    // Parse request body with error handling
    let body: ExecuteRequest;
    try {
      body = await req.json() as ExecuteRequest;
    } catch (parseError) {
      console.error('[API] Request parsing failed:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { code, input, functionName } = body;
    
    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Code is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(input)) {
      return new Response(JSON.stringify({ error: 'Input must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!functionName || typeof functionName !== 'string') {
      return new Response(JSON.stringify({ error: 'Function name is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get IAM token for testing (use tenant from header if available)
    let iamToken: string | null = null;
    try {
      console.log('[API] Attempting to get IAM token for tenant:', jiffyHeaders.tenantId || 'default');
      iamToken = await getIAMToken(jiffyHeaders.tenantId || undefined);
      console.log('[API] IAM Token obtained successfully:', {
        tenantId: jiffyHeaders.tenantId || 'default',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        tokenLength: iamToken.length,
        tokenPrefix: iamToken.substring(0, 27) + '...', // Show "Bearer " + first 20 chars
        tokenSuffix: '...' + iamToken.substring(iamToken.length - 10),
        readyToUse: iamToken.startsWith('Bearer ')
      });
    } catch (iamError) {
      console.warn('[API] Failed to get IAM token:', {
        error: iamError instanceof Error ? iamError.message : iamError,
        tenantId: jiffyHeaders.tenantId || 'default',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        functionName,
        requestId: jiffyHeaders.requestId
      });
      // Continue execution even if IAM token fails
    }

    // Execute JavaScript with comprehensive error handling
    let result: any;
    let executionTime: number;
    
    try {
      const execution = await executeJavaScript(code, input, functionName);
      result = execution.result;
      executionTime = execution.executionTime;
      
      // Log successful API execution with IAM token info and Jiffy headers
      console.log('[API] Execution successful:', {
        functionName,
        executionTime,
        iamTokenAvailable: iamToken !== null,
        iamTokenLength: iamToken?.length || 0,
        tenantId: jiffyHeaders.tenantId || 'not-provided',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        requestId: jiffyHeaders.requestId
      });
      
    } catch (executionError) {
      executionTime = (executionError as any).executionTime || 0;
      
      // Log execution error but don't crash the app
      console.error('[API] Execution error:', {
        error: executionError instanceof Error ? executionError.message : executionError,
        functionName,
        executionTime,
        tenantId: jiffyHeaders.tenantId || 'not-provided',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        requestId: jiffyHeaders.requestId
      });
      
      return new Response(JSON.stringify({ 
        error: executionError instanceof Error ? executionError.message : 'JavaScript execution failed' 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Execution-Time': `${executionTime}ms`
        }
      });
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Execution-Time': `${executionTime}ms`
      }
    });
  } catch (error) {
    // Catch any unexpected errors to prevent app crashes
    console.error('[API] Unexpected error in handleExecute:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: req.headers.get('x-jiffy-tenant-id') || 'not-provided',
      appId: req.headers.get('x-jiffy-app-id') || 'not-provided',
      userId: req.headers.get('x-jiffy-user-id') || 'not-provided',
      requestId: req.headers.get('x-request-id') || 'unknown'
    });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}