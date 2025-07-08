import { executeJavaScript } from '../services/jsExecutor';
import { getIAMToken } from '../utils/iam-token-utils';
import type { ExecuteRequest, ExecuteResponse } from '../types';

/**
 * System variable interface for automatic injection
 */
interface SystemVariable {
  appHost: string;
  header: {
    'x-jiffy-tenant-id': string;
    'x-jiffy-app-id': string;
    'x-jiffy-user-id': string;
    'authorization': string;
    'x-b3-traceid': number;
    'x-b3-spanid': number;
    'x-b3-sampled': number;
  };
}

/**
 * Generates system variable object with app host and headers
 * 
 * @param jiffyHeaders - Extracted Jiffy headers from request
 * @param iamToken - IAM Bearer token
 * @returns System variable object
 */
function generateSystemVariable(
  jiffyHeaders: {
    tenantId: string | null;
    appId: string | null;
    userId: string | null;
    requestId: string;
  },
  iamToken: string | null
): SystemVariable {
  // Hard-coded app host for now (will integrate with API later)
  const appHost = 'https://newui-checking-sftp.platform-app-integ-test.cluster.jiffy.ai/platform';
  
  return {
    appHost,
    header: {
      'x-jiffy-tenant-id': jiffyHeaders.tenantId || '',
      'x-jiffy-app-id': jiffyHeaders.appId || '',
      'x-jiffy-user-id': jiffyHeaders.userId || '',
      'authorization': iamToken || 'Bearer',
      'x-b3-traceid': 1,
      'x-b3-spanid': 1,
      'x-b3-sampled': 1
    }
  };
}

/**
 * Handles POST /execute-with-sys endpoint requests.
 * Similar to /execute but automatically generates and injects system variable at index 0.
 * 
 * @param req - HTTP request object
 * @returns HTTP response with execution result or error
 */
export async function handleExecuteWithSys(req: Request): Promise<Response> {
  try {
    // Extract Jiffy-specific headers
    const jiffyHeaders = {
      tenantId: req.headers.get('x-jiffy-tenant-id'),
      appId: req.headers.get('x-jiffy-app-id'),
      userId: req.headers.get('x-jiffy-user-id'),
      requestId: req.headers.get('x-request-id') || 'unknown'
    };

    // Log incoming request headers
    console.log('[API-SYS] Request received:', {
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
      console.error('[API-SYS] Request parsing failed:', parseError);
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

    // Get IAM token for system variable (use tenant from header if available)
    let iamToken: string | null = null;
    try {
      console.log('[API-SYS] Attempting to get IAM token for tenant:', jiffyHeaders.tenantId || 'default');
      iamToken = await getIAMToken(jiffyHeaders.tenantId || undefined);
      console.log('[API-SYS] IAM Token obtained successfully:', {
        tenantId: jiffyHeaders.tenantId || 'default',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        tokenLength: iamToken.length,
        tokenPrefix: iamToken.substring(0, 27) + '...', // Show "Bearer " + first 20 chars
        tokenSuffix: '...' + iamToken.substring(iamToken.length - 10),
        readyToUse: iamToken.startsWith('Bearer ')
      });
    } catch (iamError) {
      console.warn('[API-SYS] Failed to get IAM token:', {
        error: iamError instanceof Error ? iamError.message : iamError,
        tenantId: jiffyHeaders.tenantId || 'default',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        functionName,
        requestId: jiffyHeaders.requestId
      });
      // Continue execution even if IAM token fails
    }

    // Generate system variable object
    const systemVariable = generateSystemVariable(jiffyHeaders, iamToken);
    
    // Create new input array with system variable at index 0
    const modifiedInput = [systemVariable, ...input];
    
    console.log('[API-SYS] System variable generated and injected at index 0:', modifiedInput);

    // Execute JavaScript with comprehensive error handling
    let result: any;
    let executionTime: number;
    
    try {
      const execution = await executeJavaScript(code, modifiedInput, functionName);
      result = execution.result;
      executionTime = execution.executionTime;
      
      // Log successful API execution with IAM token info and Jiffy headers
      console.log('[API-SYS] Execution successful:', {
        functionName,
        executionTime,
        iamTokenAvailable: iamToken !== null,
        iamTokenLength: iamToken?.length || 0,
        tenantId: jiffyHeaders.tenantId || 'not-provided',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        requestId: jiffyHeaders.requestId,
        systemVariableInjected: true
      });
      
    } catch (executionError) {
      executionTime = (executionError as any).executionTime || 0;
      
      // Log execution error but don't crash the app
      console.error('[API-SYS] Execution error:', {
        error: executionError instanceof Error ? executionError.message : executionError,
        functionName,
        executionTime,
        tenantId: jiffyHeaders.tenantId || 'not-provided',
        appId: jiffyHeaders.appId || 'not-provided',
        userId: jiffyHeaders.userId || 'not-provided',
        requestId: jiffyHeaders.requestId,
        systemVariableInjected: true
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
    console.error('[API-SYS] Unexpected error in handleExecuteWithSys:', {
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