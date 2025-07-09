import { getIAMToken } from '../utils/iam-token-utils';
import { logger } from '../utils/logger';
import { executeJavaScript } from '../services/jsExecutor';
import { hasES6Imports, bundleCode } from '../services/bundleService';

/**
 * Request interface for transform endpoint
 */
interface TransformRequest {
  input: any[];
  functionName: string;
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
    const { input, functionName } = requestBody;
    
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

    // Get IAM token for authorization
    let iamToken: string | null = null;
    try {
      logger.info('Attempting to get IAM token for tenant', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`
      });

      iamToken = await getIAMToken(jiffyHeaders.tenantId || undefined);
      
      logger.info('IAM Token obtained successfully', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        tokenLength: iamToken.length,
        tokenPrefix: iamToken.substring(0, 27) + '...',
        tokenSuffix: '...' + iamToken.substring(iamToken.length - 10),
        readyToUse: iamToken.startsWith('Bearer ')
      });
    } catch (iamError) {
      logger.warn('Failed to get IAM token', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        error: iamError instanceof Error ? iamError.message : iamError
      });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to obtain authorization token' 
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Construct target URL
    const targetUrl = `https://integrationtest.jiffy.ai/platform/ngdvt/v1/transformer/defs/${path}`;
    
    // Prepare headers for the target request
    const targetHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': iamToken
    };

    // Forward original Jiffy headers
    if (jiffyHeaders.tenantId) {
      targetHeaders['x-jiffy-tenant-id'] = jiffyHeaders.tenantId;
    }
    if (jiffyHeaders.appId) {
      targetHeaders['x-jiffy-app-id'] = jiffyHeaders.appId;
    }
    if (jiffyHeaders.userId) {
      targetHeaders['x-jiffy-user-id'] = jiffyHeaders.userId;
    }
    if (jiffyHeaders.requestId) {
      targetHeaders['x-request-id'] = jiffyHeaders.requestId;
    }

    // Forward additional headers from original request
    const additionalHeaders = ['user-agent', 'x-b3-traceid', 'x-b3-spanid', 'x-b3-sampled'];
    additionalHeaders.forEach(headerName => {
      const headerValue = req.headers.get(headerName);
      if (headerValue) {
        targetHeaders[headerName] = headerValue;
      }
    });

    const startTime = performance.now();
    
    // Make the GET request to transformer service
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: targetHeaders
      });

      const endTime = performance.now();
      const executionTime = Math.round((endTime - startTime) * 100) / 100;

      // Get response body
      const responseBody = await response.text();
      
      if (response.ok) {
        // Log successful transformer call
        logger.info('Transformer API call completed', {
          tenantId: jiffyHeaders.tenantId,
          appId: jiffyHeaders.appId,
          userId: jiffyHeaders.userId,
          requestId: jiffyHeaders.requestId
        }, {
          path: `/transform/${path}`,
          endpoint: `POST /transform/${path}`,
          targetUrl,
          executionTime,
          status: 'success',
          responseStatus: response.status,
          iamTokenAvailable: iamToken !== null
        });

        // Parse transformer response
        let transformerResponse: any;
        try {
          transformerResponse = JSON.parse(responseBody);
        } catch (jsonError) {
          logger.error('Failed to parse transformer response', {
            tenantId: jiffyHeaders.tenantId,
            appId: jiffyHeaders.appId,
            userId: jiffyHeaders.userId,
            requestId: jiffyHeaders.requestId
          }, {
            path: `/transform/${path}`,
            endpoint: `POST /transform/${path}`,
            error: jsonError,
            responseBody: responseBody.substring(0, 500)
          });
          return new Response(JSON.stringify({ error: 'Invalid JSON response from transformer service' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Extract jsFile from response
        if (!transformerResponse.jsFile) {
          logger.error('No jsFile found in transformer response', {
            tenantId: jiffyHeaders.tenantId,
            appId: jiffyHeaders.appId,
            userId: jiffyHeaders.userId,
            requestId: jiffyHeaders.requestId
          }, {
            path: `/transform/${path}`,
            endpoint: `POST /transform/${path}`,
            responseKeys: Object.keys(transformerResponse)
          });
          return new Response(JSON.stringify({ error: 'No jsFile found in transformer response' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Parse jsFile to get jsCode
        let jsFileData: any;
        try {
          jsFileData = JSON.parse(transformerResponse.jsFile);
        } catch (jsFileError) {
          logger.error('Failed to parse jsFile', {
            tenantId: jiffyHeaders.tenantId,
            appId: jiffyHeaders.appId,
            userId: jiffyHeaders.userId,
            requestId: jiffyHeaders.requestId
          }, {
            path: `/transform/${path}`,
            endpoint: `POST /transform/${path}`,
            error: jsFileError,
            jsFile: transformerResponse.jsFile.substring(0, 500)
          });
          return new Response(JSON.stringify({ error: 'Invalid jsFile format in transformer response' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Extract jsCode
        if (!jsFileData.jsCode) {
          logger.error('No jsCode found in jsFile', {
            tenantId: jiffyHeaders.tenantId,
            appId: jiffyHeaders.appId,
            userId: jiffyHeaders.userId,
            requestId: jiffyHeaders.requestId
          }, {
            path: `/transform/${path}`,
            endpoint: `POST /transform/${path}`,
            jsFileKeys: Object.keys(jsFileData)
          });
          return new Response(JSON.stringify({ error: 'No jsCode found in jsFile' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        let jsCode = jsFileData.jsCode;
        
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
            jsCode = await bundleCode(jsCode);
            logger.info('Code bundling completed successfully', {
              tenantId: jiffyHeaders.tenantId,
              appId: jiffyHeaders.appId,
              userId: jiffyHeaders.userId,
              requestId: jiffyHeaders.requestId
            }, {
              path: `/transform/${path}`,
              endpoint: `POST /transform/${path}`,
              originalLength: jsFileData.jsCode.length,
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
        try {
          const jsStartTime = performance.now();
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
            totalTime: executionTime + jsExecutionTime,
            status: 'success',
            resultType: typeof execution.result
          });

          return new Response(JSON.stringify(execution.result), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'X-Execution-Time': `${jsExecutionTime}ms`,
              'X-Total-Time': `${executionTime + jsExecutionTime}ms`
            }
          });
        } catch (jsError) {
          const jsEndTime = performance.now();
          const jsExecutionTime = Math.round((jsEndTime - startTime) * 100) / 100;
          
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
            totalTime: executionTime + jsExecutionTime,
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
              'X-Execution-Time': `${jsExecutionTime}ms`,
              'X-Total-Time': `${executionTime + jsExecutionTime}ms`
            }
          });
        }
      } else {
        // Log failed transformer call
        logger.error('Transformer API call failed', {
          tenantId: jiffyHeaders.tenantId,
          appId: jiffyHeaders.appId,
          userId: jiffyHeaders.userId,
          requestId: jiffyHeaders.requestId
        }, {
          path: `/transform/${path}`,
          endpoint: `POST /transform/${path}`,
          targetUrl,
          executionTime,
          status: 'failed',
          responseStatus: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseBody: responseBody.substring(0, 500)
        });

        return new Response(JSON.stringify({ 
          error: `Transformer service error: ${response.status} ${response.statusText}`
        }), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Execution-Time': `${executionTime}ms`
          }
        });
      }
    } catch (fetchError) {
      const endTime = performance.now();
      const executionTime = Math.round((endTime - startTime) * 100) / 100;

      logger.error('Transformer API call failed', {
        tenantId: jiffyHeaders.tenantId,
        appId: jiffyHeaders.appId,
        userId: jiffyHeaders.userId,
        requestId: jiffyHeaders.requestId
      }, {
        path: `/transform/${path}`,
        endpoint: `POST /transform/${path}`,
        targetUrl,
        executionTime,
        status: 'failed',
        error: fetchError instanceof Error ? fetchError.message : fetchError
      });

      return new Response(JSON.stringify({ 
        error: 'Failed to connect to transformer service' 
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Execution-Time': `${executionTime}ms`
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