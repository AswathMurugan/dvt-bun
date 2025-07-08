/**
 * Java Bridge - TypeScript implementation of Java classes for JavaScript execution
 * Provides seamless integration without code migration
 */

import {getIAMToken} from './iam-token-utils';

/**
 * HTTP Method type definition
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Special response object that behaves synchronously for existing JavaScript code
 */
class SyncResponse {
  private promise: Promise<string>;
  private resolved: boolean = false;
  private result: string = '';
  private error: Error | null = null;

  constructor(promise: Promise<string>) {
    this.promise = promise;
    
    // Immediately start resolving the promise
    promise
      .then((response) => {
        this.result = response;
        this.resolved = true;
      })
      .catch((err) => {
        this.error = err;
        this.resolved = true;
      });
  }

  /**
   * Override toString to return the actual response when used as a string
   */
  toString(): string {
    // Wait for resolution using a more efficient approach
    if (!this.resolved) {
      // Create a synchronous wait with smaller delays
      let attempts = 0;
      const maxAttempts = 120000; // 12 second timeout (within VM timeout)
      
      while (!this.resolved && attempts < maxAttempts) {
        // Much smaller delay to be more responsive
        for (let i = 0; i < 10000; i++) {
          // Small CPU-bound operation to create delay
          Math.random();
        }
        attempts++;
      }
      
      // If still not resolved after timeout, log and return empty result
      if (!this.resolved) {
        console.error('[SyncResponse] Timeout waiting for HTTP response after 12 seconds');
        return '';
      }
    }
    
    if (this.error) {
      console.error('[SyncResponse] HTTP error occurred:', this.error.message);
      throw this.error;
    }
    
    console.log('[SyncResponse] Returning response:', this.result.substring(0, 200));
    return this.result;
  }

  /**
   * Override valueOf to return the string value
   */
  valueOf(): string {
    return this.toString();
  }

  /**
   * Make it work with JSON.parse by ensuring string conversion
   */
  [Symbol.toPrimitive](hint: string): string {
    return this.toString();
  }
}

/**
 * TypeScript implementation of Java RestClient class
 * Maintains identical API surface for seamless JavaScript integration
 */
export class RestClient {
  
  /**
   * Default constructor - matches Java RestClient
   */
  constructor() {
    // Default constructor intentionally left empty for framework requirements
  }

  /**
   * Makes HTTP REST API calls - identical to Java RestClient.call()
   * Returns a Promise that resolves to the response string
   * 
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param url - Target URL for the request
   * @param headers - Map of headers to include
   * @param body - Request body (for POST/PUT/PATCH)
   * @returns Promise resolving to response body as string
   */
  call(
    method: string, 
    url: string, 
    headers: { [key: string]: string }, 
    body?: string
  ): Promise<string> {
    return this.makeHttpCall(method, url, headers, body);
  }

  /**
   * Internal method to make HTTP calls
   */
  private async makeHttpCall(
    method: string, 
    url: string, 
    headers: { [key: string]: string }, 
    body?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    console.log(`[DSL-JS] Execution Method: ${method} URL: ${url}`);
    
    try {
      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      // Add service account token (matches Java implementation)
      const jwtToken = await this.getAccessToken();
      if (jwtToken && jwtToken.length > 0) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Authorization': jwtToken
        };
      }

      // Add body for non-GET requests
      if (body && !['GET', 'DELETE'].includes(method.toUpperCase())) {
        fetchOptions.body = body;
      }

      // Execute the HTTP request
      const response = await fetch(url, fetchOptions);
      
      // Get response body (regardless of status for debugging)
      const responseBody = await response.text();
      
      // Log response details for debugging
      console.log(`[DSL-JS] Response status: ${response.status} ${response.statusText}`);
      console.log(`[DSL-JS] Response headers:`, Object.fromEntries(response.headers.entries()));
      
      // Check if response is successful
      if (!response.ok) {
        console.error(`[DSL-JS] HTTP Error: ${response.status} ${response.statusText} for URL: ${url}`);
        console.error(`[DSL-JS] Error response body:`, responseBody.substring(0, 500));
        
        // Throw HTTP error directly to API response
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseBody}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`[Lite Workflow] Rest call completed URL: ${url} ${duration}ms`);
      console.log(`[DSL-JS] Response body preview:`, responseBody.substring(0, 200) + (responseBody.length > 200 ? '...' : ''));
      
      return responseBody;
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`[DSL-JS] Rest call failed URL: ${url} ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Custom logging with MDC context - identical to Java RestClient.customLog()
   * 
   * @param message - Log message
   * @param workflowId - Workflow identifier
   * @param topParentId - Top parent workflow identifier
   * @param headers - Headers map containing tracing information
   */
  customLog(
    message: string, 
    workflowId: string, 
    topParentId: string, 
    headers: { [key: string]: string }
  ): void {
    // Simulate MDC (Mapped Diagnostic Context) logging
    const mdcContext = {
      correlationId: workflowId,
      workflowId: workflowId,
      topParentWorkflowId: topParentId,
      tenantId: headers['x-jiffy-tenant-id'],
      appId: headers['x-jiffy-app-id'],
      xB3TraceId: headers['x-b3-traceid'],
      xB3ParentSpanId: headers['x-b3-parentspanid'],
      xB3Sampled: headers['x-b3-sampled'],
      userLog: 'true'
    };
    
    // Log with MDC context (similar to Java's MDC.put)
    console.log('[USER-LOG]', {
      message,
      ...mdcContext
    });
  }

  /**
   * Gets access token using IAM token utilities - matches Java getAccessToken()
   * 
   * @returns Bearer token string
   */
  async getAccessToken(): Promise<string> {
    try {
      // Use existing IAM token utility
      return await getIAMToken(); // Already includes "Bearer " prefix
    } catch (error) {
      console.warn('[RestClient] Failed to get access token:', error);
      return ''; // Return empty string on failure (matches Java behavior)
    }
  }
}

/**
 * Java bridge utilities for seamless JavaScript integration
 */
export class JavaBridge {
  
  /**
   * Mock implementation of Java.type() for JavaScript compatibility
   * 
   * @param className - Java class name to mock
   * @returns Constructor function for the TypeScript equivalent
   */
  static type(className: string): any {
    switch (className) {
      case 'ai.jiffy.apex.utils.RestClient':
        return RestClient;
      default:
        console.warn(`[JavaBridge] Unknown Java class: ${className}`);
        return class UnknownClass {};
    }
  }
}

/**
 * Global Java object mock for JavaScript execution context
 */
export const JavaMock = {
  type: JavaBridge.type
};

/**
 * Factory function to create RestClient instances
 */
export function createRestClient(): RestClient {
  return new RestClient();
}