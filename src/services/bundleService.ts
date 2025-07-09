/**
 * JavaScript/TypeScript Bundling Service
 * Uses ESBuild to bundle code with ES6 imports and resolve dependencies
 */

import { logger } from '../utils/logger';
import { getConfig } from '../config/config.loader';

/**
 * Bundle JavaScript/TypeScript code using ESBuild
 * Resolves ES6 imports from node_modules and bundles into executable code
 * 
 * @param code - The JavaScript/TypeScript code to bundle
 * @returns Promise resolving to bundled JavaScript code
 * @throws Error if bundling fails
 */
export async function bundleCode(code: string): Promise<string> {
  try {
    // Dynamic import to avoid bundling esbuild in the main bundle
    const esbuild = require('esbuild');
    
    // Get configuration
    const config = getConfig();
    const nodeModulesPath = config.nodeModulesPath;
    
    logger.info('BUNDLE Starting code bundling', {}, {
      codeLength: code.length,
      nodeModulesPath
    });
    
    const result = await esbuild.build({
      stdin: {
        contents: code,
        loader: 'ts', // Support both JavaScript and TypeScript
        resolveDir: process.cwd()
      },
      format: 'esm', // ES Module format
      bundle: true, // Bundle all dependencies
      nodePaths: [nodeModulesPath], // Node modules resolution paths from config
      write: false, // Don't write to disk, return contents in memory
      minify: false, // Keep readable for debugging
      sourcemap: false, // No source maps needed
      target: 'es2020', // Modern JavaScript target
      platform: 'node', // Node.js platform
      packages: 'bundle', // Bundle all packages including node_modules
      treeShaking: true, // Remove unused code
      logLevel: 'silent' // Suppress esbuild logs, we'll handle our own logging
    });
    
    // Check for bundling errors
    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map((error: any) => error.text).join(', ');
      logger.error('BUNDLE Bundling failed with errors', {}, {
        errors: result.errors,
        errorMessages
      });
      throw new Error(`ESBuild bundling failed: ${errorMessages}`);
    }
    
    // Check for bundling warnings
    if (result.warnings && result.warnings.length > 0) {
      logger.warn('BUNDLE Bundling completed with warnings', {}, {
        warnings: result.warnings,
        warningMessages: result.warnings.map((warning: any) => warning.text).join(', ')
      });
    }
    
    // Get bundled code
    if (!result.outputFiles || result.outputFiles.length === 0) {
      logger.error('BUNDLE No output files generated');
      throw new Error('ESBuild generated no output files');
    }
    
    const bundledCode = result.outputFiles[0].text;
    
    logger.info('BUNDLE Code bundling completed successfully', {}, {
      originalLength: code.length,
      bundledLength: bundledCode.length,
      compressionRatio: Math.round((bundledCode.length / code.length) * 100) / 100
    });
    
    return bundledCode;
    
  } catch (error) {
    logger.error('BUNDLE Code bundling failed', {}, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      codeLength: code.length
    });
    
    throw new Error(`Failed to bundle JavaScript code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if JavaScript code contains ES6 import statements
 * 
 * @param code - The JavaScript code to check
 * @returns true if code contains ES6 imports, false otherwise
 */
export function hasES6Imports(code: string): boolean {
  // Check for various ES6 import patterns
  const importPatterns = [
    /import\s+.*\s+from\s+['"][^'"]+['"]/,  // import something from 'module'
    /import\s+['"][^'"]+['"]/,              // import 'module'
    /import\s*\(/,                          // dynamic import()
    /import\s*\{[^}]*\}\s*from/,           // import { something } from
    /import\s*\*\s*as\s+\w+\s*from/        // import * as something from
  ];
  
  return importPatterns.some(pattern => pattern.test(code));
}

/**
 * Check if JavaScript code contains export statements
 * 
 * @param code - The JavaScript code to check
 * @returns true if code contains export statements, false otherwise
 */
export function hasES6Exports(code: string): boolean {
  // Check for various ES6 export patterns
  const exportPatterns = [
    /export\s+default\s+/,                 // export default
    /export\s+\{[^}]*\}/,                  // export { something }
    /export\s+\*\s+from/,                  // export * from
    /export\s+(const|let|var|function|class)/, // export const/let/var/function/class
    /export\s+\{[^}]*\}\s*from/            // export { something } from
  ];
  
  return exportPatterns.some(pattern => pattern.test(code));
}

/**
 * Check if JavaScript code needs bundling (has ES6 imports or exports)
 * 
 * @param code - The JavaScript code to check
 * @returns true if code needs bundling, false otherwise
 */
export function needsBundling(code: string): boolean {
  return hasES6Imports(code) || hasES6Exports(code);
}