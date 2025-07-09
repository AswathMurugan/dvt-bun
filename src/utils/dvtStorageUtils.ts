/**
 * DVT Storage Utility
 * Handles retrieval of JavaScript code from DVT storage service
 */

import { getIAMToken } from './iam-token-utils';
import { logger } from './logger';
import { getConfig } from '../config/config.loader';

/**
 * Context interface for DVT storage operations
 */
export interface DVTStorageContext {
  tenantId?: string | null;
  appId?: string | null;
  userId?: string | null;
  requestId?: string | null;
}

/**
 * Response interface from DVT storage service
 */
export interface DVTStorageResponse {
  jsFile: string;
  [key: string]: any;
}

/**
 * Parsed JavaScript file interface
 */
export interface ParsedJSFile {
  jsCode: string;
  [key: string]: any;
}

/**
 * Get JavaScript code from DVT storage service
 * 
 * @param path - The path to the JavaScript definition in DVT storage
 * @param context - Context information for logging and headers
 * @returns Promise resolving to the JavaScript code
 * @throws Error if retrieval or parsing fails
 */
export async function getJSCodeFromDVTStorage(path: string, context: DVTStorageContext = {}): Promise<string> {
  const startTime = performance.now();
  
  try {
    // Get configuration
    const config = getConfig();
    const targetUrl = `${config.dvtStorageHost}/ngdvt/v1/transformer/defs/${path}`;
    
    logger.info('DVT_STORAGE Requesting JavaScript code', {
      tenantId: context.tenantId,
      appId: context.appId,
      userId: context.userId,
      requestId: context.requestId
    }, {
      path,
      targetUrl
    });

    // Get IAM token for authorization
    let iamToken: string;
    try {
      iamToken = await getIAMToken(context.tenantId || undefined);
      logger.info('DVT_STORAGE IAM token obtained', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        tokenLength: iamToken.length
      });
    } catch (iamError) {
      logger.error('DVT_STORAGE Failed to get IAM token', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        error: iamError instanceof Error ? iamError.message : iamError
      });
      throw new Error(`Failed to obtain IAM token: ${iamError instanceof Error ? iamError.message : 'Unknown error'}`);
    }

    // Prepare headers for the request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': iamToken
    };

    // Add context headers if available
    if (context.tenantId) {
      headers['x-jiffy-tenant-id'] = context.tenantId;
    }
    if (context.appId) {
      headers['x-jiffy-app-id'] = context.appId;
    }
    if (context.userId) {
      headers['x-jiffy-user-id'] = context.userId;
    }
    if (context.requestId) {
      headers['x-request-id'] = context.requestId;
    }

    // Make the request to DVT storage
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers
    });

    const endTime = performance.now();
    const requestTime = Math.round((endTime - startTime) * 100) / 100;

    // Handle response
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('DVT_STORAGE API call failed', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        targetUrl,
        status: response.status,
        statusText: response.statusText,
        requestTime,
        errorBody: errorBody.substring(0, 500)
      });
      throw new Error(`DVT storage API failed: ${response.status} ${response.statusText}`);
    }

    // Parse response
    const responseBody = await response.text();
    let storageResponse: DVTStorageResponse;
    
    try {
      storageResponse = JSON.parse(responseBody) as DVTStorageResponse;
    } catch (parseError) {
      logger.error('DVT_STORAGE Failed to parse response', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        targetUrl,
        requestTime,
        error: parseError,
        responseBody: responseBody.substring(0, 500)
      });
      throw new Error('Invalid JSON response from DVT storage service');
    }

    // Extract jsFile from response
    if (!storageResponse.jsFile) {
      logger.error('DVT_STORAGE No jsFile in response', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        targetUrl,
        requestTime,
        responseKeys: Object.keys(storageResponse)
      });
      throw new Error('No jsFile found in DVT storage response');
    }

    // Parse jsFile to get jsCode
    let jsFileData: ParsedJSFile;
    try {
      jsFileData = JSON.parse(storageResponse.jsFile) as ParsedJSFile;
    } catch (jsFileError) {
      logger.error('DVT_STORAGE Failed to parse jsFile', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        targetUrl,
        requestTime,
        error: jsFileError,
        jsFile: storageResponse.jsFile.substring(0, 500)
      });
      throw new Error('Invalid jsFile format in DVT storage response');
    }

    // Extract jsCode
    if (!jsFileData.jsCode) {
      logger.error('DVT_STORAGE No jsCode in jsFile', {
        tenantId: context.tenantId,
        appId: context.appId,
        userId: context.userId,
        requestId: context.requestId
      }, {
        path,
        targetUrl,
        requestTime,
        jsFileKeys: Object.keys(jsFileData)
      });
      throw new Error('No jsCode found in jsFile');
    }

    const jsCode = jsFileData.jsCode;

    logger.info('DVT_STORAGE JavaScript code retrieved successfully', {
      tenantId: context.tenantId,
      appId: context.appId,
      userId: context.userId,
      requestId: context.requestId
    }, {
      path,
      targetUrl,
      requestTime,
      codeLength: jsCode.length
    });

    return jsCode;

  } catch (error) {
    const endTime = performance.now();
    const requestTime = Math.round((endTime - startTime) * 100) / 100;

    logger.error('DVT_STORAGE Failed to retrieve JavaScript code', {
      tenantId: context.tenantId,
      appId: context.appId,
      userId: context.userId,
      requestId: context.requestId
    }, {
      path,
      requestTime,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });

    throw error;
  }
}