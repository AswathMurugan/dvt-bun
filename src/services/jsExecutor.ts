import { VM } from 'vm2';
import { RestClient, JavaMock } from '../utils/java-bridge';
import { logger } from '../utils/logger';

// Use require for xmlhttprequest to avoid TypeScript declaration issues
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

/**
 * Removes export statements from the end of JavaScript code.
 * This allows execution of bundled code with export statements.
 * 
 * @param code - The JavaScript code to clean up
 * @returns The code with export statements removed from the end
 */
function cleanupCode(code: string): string {
  // Remove export statements ONLY from the very end of the code
  // This ensures exports in the middle of code (like in comments or strings) are preserved
  let cleanedCode = code.trim();
  
  // Remove trailing semicolons and whitespace first
  cleanedCode = cleanedCode.replace(/\s*;?\s*$/, '');
  
  // Define patterns that should only match at the absolute end
  const endExportPatterns = [
    // export { functionName as default }
    /\s*export\s*\{\s*\w+\s*as\s*default\s*\}$/,
    // export default functionName
    /\s*export\s*default\s+\w+$/,
    // export { func1, func2, ... }
    /\s*export\s*\{\s*[\w\s,]+\s*\}$/,
    // export * from "module"
    /\s*export\s*\*\s*from\s*['"]\w+['"]$/,
    // module.exports = functionName
    /\s*module\.exports\s*=\s*\w+$/
  ];
  
  // Apply patterns iteratively until no more matches (handles multiple export statements)
  let previousLength;
  do {
    previousLength = cleanedCode.length;
    for (const pattern of endExportPatterns) {
      cleanedCode = cleanedCode.replace(pattern, '').trim();
    }
  } while (cleanedCode.length < previousLength && cleanedCode.length > 0);
  
  return cleanedCode;
}

/**
 * Executes JavaScript code in a secure VM2 sandbox environment.
 * Supports async functions, HTTP requests, and bundled code.
 * 
 * @param code - The JavaScript code containing the function to execute
 * @param input - Array of parameters to pass to the function
 * @param functionName - Name of the function to call
 * @returns Promise containing the execution result and timing information
 * @throws Error if execution fails, times out, or function is not found
 */
export async function executeJavaScript(code: string, input: any[], functionName: string, skipWrapper: boolean = false): Promise<{ result: any; executionTime: number }> {
  const startTime = performance.now();
  let vm: VM | null = null;
  
  try {
    // Validate inputs with detailed error handling
    try {
      validateCode(code);
      validateFunctionName(functionName);
    } catch (validationError) {
      const endTime = performance.now();
      const executionTime = Math.round((endTime - startTime) * 100) / 100;
      logger.error('EXECUTOR Validation error', {}, { error: validationError });
      throw Object.assign(new Error(validationError instanceof Error ? validationError.message : 'Validation failed'), { executionTime });
    }
    
    const cleanedCode = cleanupCode(code);
    
    // Auto-fix RestClient calls if code uses Java.type pattern
    let processedCode = cleanedCode;
    if (cleanedCode.includes('Java.type("ai.jiffy.apex.utils.RestClient")') && 
        cleanedCode.includes('new RestClient()') &&
        cleanedCode.includes('.call(')) {
      
      logger.info('EXECUTOR Detected RestClient usage, adding await to .call() methods');
      
      // Replace myRestClient.call( with await myRestClient.call( (simple and safe)
      processedCode = cleanedCode.replace(
        /myRestClient\.call\s*\(/g, 
        'await myRestClient.call('
      );
      
      logger.info('EXECUTOR Full processed code', {}, { processedCode });
    }
    
    // Create VM2 instance with comprehensive sandbox for safe execution
    vm = new VM({
      timeout: 15000, // 15-second execution limit (increased for HTTP calls)
      sandbox: {
        // HTTP support
        fetch: fetch,
        XMLHttpRequest: XMLHttpRequest,
        
        // Console support
        console: {
          log: (...args: any[]) => logger.info('VM', {}, { args }),
          error: (...args: any[]) => logger.error('VM', {}, { args }),
          warn: (...args: any[]) => logger.warn('VM', {}, { args }),
          info: (...args: any[]) => logger.info('VM', {}, { args })
        },

        // Timer support
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,

        // Promise and URL support
        Promise: Promise,
        URL: URL,
        URLSearchParams: URLSearchParams,
        
        // Java bridge for seamless integration
        Java: JavaMock,
        RestClient: RestClient,
        
        // Global objects that axios might need
        global: {
          XMLHttpRequest: XMLHttpRequest,
          fetch: fetch
        },
        document: undefined,
        
        // Additional globals for better compatibility
        process: {
          env: {
            NODE_ENV: 'development'
          },
          nextTick: (cb: Function) => setTimeout(cb, 0)
        },
      },
      allowAsync: true
    });
    
    let wrappedCode: string;
    
    if (skipWrapper) {
      // For transform API - code may be bundled and already has error handling
      // Check if this looks like bundled code (no imports/exports, more complex structure)
      const isBundledCode = !processedCode.includes('import ') && 
                           !processedCode.includes('export ') && 
                           processedCode.length > 1000; // Bundled code is typically larger
      
      if (isBundledCode) {
        // Bundled code - execute directly, it should have proper function definitions
        wrappedCode = `
          ${processedCode}
          
          // For bundled code, the function should be available directly
          if (typeof ${functionName} !== 'function') {
            throw new Error('Function "${functionName}" is not defined or not a function in bundled code');
          }
          
          const __result__ = ${functionName}(...${JSON.stringify(input)});
          __result__;
        `;
      } else {
        // Non-bundled transform code - code already has try-catch, just execute directly
        wrappedCode = `
          ${processedCode}
          
          if (typeof ${functionName} !== 'function') {
            throw new Error('Function "${functionName}" is not defined or not a function');
          }
          
          const __result__ = ${functionName}(...${JSON.stringify(input)});
          __result__;
        `;
      }
    } else {
      // For regular execute API - wrap in try-catch for better error handling
      wrappedCode = `
        try {
          ${processedCode}
          
          if (typeof ${functionName} !== 'function') {
            throw new Error('Function "${functionName}" is not defined or not a function');
          }
          
          const __result__ = ${functionName}(...${JSON.stringify(input)});
          __result__;
        } catch (__error__) {
          // Re-throw the exact error that occurred during execution
          throw __error__;
        }
      `;
    }
    
    // Execute code with additional error handling
    let result: any;
    try {
      result = await vm.run(wrappedCode);
    } catch (vmError) {
      const endTime = performance.now();
      const executionTime = Math.round((endTime - startTime) * 100) / 100;
      
      // Log VM execution error for debugging
      logger.error('EXECUTOR VM execution failed', {}, {
        error: vmError instanceof Error ? vmError.message : vmError,
        functionName,
        executionTime,
        codeLength: cleanedCode.length
      });
      
      // Ensure VM is cleaned up
      try {
        vm = null;
      } catch (cleanupError) {
        logger.error('EXECUTOR VM cleanup error', {}, { error: cleanupError });
      }
      
      throw Object.assign(new Error(vmError instanceof Error ? vmError.message : 'VM execution failed'), { executionTime });
    }
    
    const endTime = performance.now();
    const executionTime = Math.round((endTime - startTime) * 100) / 100;
    
    // Log successful execution
    logger.info('EXECUTOR Execution completed', {}, {
      functionName,
      executionTime,
      resultType: typeof result
    });
    
    return { result, executionTime };
  } catch (error) {
    const endTime = performance.now();
    const executionTime = Math.round((endTime - startTime) * 100) / 100;
    
    // Ensure VM cleanup on any error
    if (vm) {
      try {
        vm = null;
      } catch (cleanupError) {
        logger.error('EXECUTOR VM cleanup error in catch block', {}, { error: cleanupError });
      }
    }
    
    // Enhanced error handling with detailed logging
    logger.error('EXECUTOR Execution failed', {}, {
      error: error instanceof Error ? error.message : error,
      functionName,
      executionTime,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error instanceof Error) {
      // Check if error already has executionTime (from inner try-catch)
      if ((error as any).executionTime) {
        throw error;
      }
      
      if (error.message.includes('timeout')) {
        throw Object.assign(new Error('Code execution timed out (max 5 seconds)'), { executionTime });
      }
      if (error.message.includes('not allowed') || error.message.includes('restricted')) {
        throw Object.assign(new Error('Code contains restricted operations'), { executionTime });
      }
      if (error.message.includes('not defined') || error.message.includes('not a function')) {
        throw Object.assign(new Error(`Function "${functionName}" is not defined or not a function`), { executionTime });
      }
      
      throw Object.assign(new Error(`Execution error: ${error.message}`), { executionTime });
    }
    
    throw Object.assign(new Error('Unknown execution error occurred'), { executionTime });
  }
}

/**
 * Validates JavaScript code input.
 * Ensures code is a non-empty string.
 * 
 * @param code - The JavaScript code to validate
 * @returns true if code is valid
 * @throws Error if code is invalid
 */
export function validateCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required and must be a string');
  }
  
  return true;
}

/**
 * Validates function name input.
 * Ensures function name is a valid JavaScript identifier.
 * 
 * @param functionName - The function name to validate
 * @returns true if function name is valid
 * @throws Error if function name is invalid
 */
export function validateFunctionName(functionName: string): boolean {
  if (!functionName || typeof functionName !== 'string') {
    throw new Error('Function name is required and must be a string');
  }
  
  const validFunctionNamePattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (!validFunctionNamePattern.test(functionName)) {
    throw new Error('Function name must be a valid JavaScript identifier');
  }
  
  return true;
}