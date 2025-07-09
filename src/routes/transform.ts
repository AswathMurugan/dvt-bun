import { logger } from '../utils/logger';
import { executeJavaScript } from '../services/jsExecutor';
import { hasES6Imports, bundleCode } from '../services/bundleService';
import { getJSCodeFromDVTStorage } from '../utils/dvtStorageUtils';

/**
 * Request interface for transform endpoint
 */
interface TransformRequest {
  input: any[];
  functionName?: string;
}

/**
 * Handles POST /transform/{*path} endpoint requests.
 * Calls Jiffy transformer service to get JavaScript code, then executes it.
 * 
 * @param req - HTTP request object
 * @param path - Dynamic path segment from URL
 * @returns HTTP response with execution result
 */
export async function handleTransform(req: Request, path: string): Promise<Response> {
  try {
    // Extract Jiffy-specific headers
    const jiffyHeaders = {
      tenantId: req.headers.get('x-jiffy-tenant-id'),
      appId: req.headers.get('x-jiffy-app-id'),
      userId: req.headers.get('x-jiffy-user-id'),
      requestId: req.headers.get('x-request-id') || 'unknown'
    };

    // Log incoming request
    logger.info('Request received', {
      tenantId: jiffyHeaders.tenantId,
      appId: jiffyHeaders.appId,
      userId: jiffyHeaders.userId,
      requestId: jiffyHeaders.requestId
    }, {
      path: `/transform/${path}`,
      endpoint: `POST /transform/${path}`,
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    // Parse request body
    let requestBody: TransformRequest;
    try {
      requestBody = await req.json() as TransformRequest;
    } catch (parseError) {
      logger.error('Request parsing failed', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        error: parseError
      });
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate request body
    const { input, functionName = 'main' } = requestBody;
    
    if (!Array.isArray(input)) {
      return new Response(JSON.stringify({ error: 'Input must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (functionName && typeof functionName !== 'string') {
      return new Response(JSON.stringify({ error: 'Function name must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get JavaScript code from DVT storage
    let jsCode: string;
    try {
      jsCode = await getJSCodeFromDVTStorage(path, {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      });
    } catch (storageError) {
      logger.error('Failed to retrieve JavaScript code from DVT storage', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        error: storageError instanceof Error ? storageError.message : storageError
      });
      
      return new Response(JSON.stringify({ 
        error: `Failed to retrieve JavaScript code: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`
      }), {
        status: 502,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Check if code has ES6 imports and bundle if needed
    let needsBundling = false;
    if (hasES6Imports(jsCode)) {
      needsBundling = true;
      logger.info('ES6 imports detected, starting bundling process', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        originalCodeLength: jsCode.length
      });

      try {
        const originalCodeLength = jsCode.length;
        jsCode = await bundleCode(jsCode);
        logger.info('Code bundling completed successfully', {
          tenantId: jiffyHeaders.tenantId,
          appId: jiffyHeaders.appId,
          userId: jiffyHeaders.userId,
          requestId: jiffyHeaders.requestId
        }, {
          path: `/transform/${path}`,
          endpoint: `POST /transform/${path}`,
          originalLength: originalCodeLength,
          bundledLength: jsCode.length
        });
      } catch (bundleError) {
        logger.error('Code bundling failed', {
          tenantId: jiffyHeaders.tenantId,
          appId: jiffyHeaders.appId,
          userId: jiffyHeaders.userId,
          requestId: jiffyHeaders.requestId
        }, {
          path: `/transform/${path}`,
          endpoint: `POST /transform/${path}`,
          error: bundleError instanceof Error ? bundleError.message : bundleError
        });
        return new Response(JSON.stringify({ 
          error: `Code bundling failed: ${bundleError instanceof Error ? bundleError.message : 'Unknown error'}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    logger.info('Starting JavaScript execution', {
      tenantId: jiffyHeaders.tenantId,
      appId: jiffyHeaders.appId,
      userId: jiffyHeaders.userId,
      requestId: jiffyHeaders.requestId
    }, {
      path: `/transform/${path}`,
      endpoint: `POST /transform/${path}`,
      functionName,
      codeLength: jsCode.length,
      wasBundled: needsBundling
    });

    console.log(jsCode);

    // Execute the JavaScript code
    const jsStartTime = performance.now();
    try {
      const execution = await executeJavaScript(jsCode, input, functionName, true);
      const jsEndTime = performance.now();
      const jsExecutionTime = Math.round((jsEndTime - jsStartTime) * 100) / 100;
      
      // Log successful execution
      logger.info('Execution completed', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        functionName,
        executionTime: jsExecutionTime,
        status: 'success',
        resultType: typeof execution.result
      });

      return new Response(JSON.stringify(execution.result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Execution-Time': `${jsExecutionTime}ms`
        }
      });
    } catch (jsError) {
      const jsEndTime = performance.now();
      const jsExecutionTime = Math.round((jsEndTime - jsStartTime) * 100) / 100;
      
      logger.error('Execution failed', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        functionName,
        executionTime: jsExecutionTime,
        status: 'failed',
        error: jsError instanceof Error ? jsError.message : jsError
      });

      return new Response(JSON.stringify({ 
        error: jsError instanceof Error ? jsError.message : 'JavaScript execution failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Execution-Time': `${jsExecutionTime}ms`
        }
      });
    }
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Unexpected error in handleTransform', {
      tenantId: req.headers.get('x-jiffy-tenant-id'),
      appId: req.headers.get('x-jiffy-app-id'),
      userId: req.headers.get('x-jiffy-user-id'),
      requestId: req.headers.get('x-request-id')
    }, {
      path: `/transform/${path}`,
      endpoint: `POST /transform/${path}`,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
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