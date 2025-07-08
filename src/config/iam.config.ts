/**
 * IAM Configuration
 * Now loads from YAML-based application configuration
 */

import { IAMConfig } from '../utils/iam-token-utils';
import { getConfig } from './config.loader';

/**
 * IAM Configuration interface for deployment-specific settings
 */
export interface DeploymentIAMConfig extends IAMConfig {
  timeout: number;
  retryAttempts: number;
}

/**
 * Get IAM configuration from YAML configuration
 */
export function getIAMConfig(): DeploymentIAMConfig {
  const appConfig = getConfig();
  
  return {
    url: appConfig.iam.url,
    grantType: appConfig.iam.grantType,
    scope: appConfig.iam.scope,
    clientId: appConfig.iam.clientId,
    clientSecret: appConfig.iam.clientSecret,
    tenantName: appConfig.iam.tenantName,
    timeout: appConfig.iam.timeout,
    retryAttempts: appConfig.iam.retryAttempts
  };
}

/**
 * Configuration validation
 */
export function validateIAMConfig(config: DeploymentIAMConfig): boolean {
  const required = ['url', 'grantType', 'scope', 'clientId', 'clientSecret', 'tenantName'];
  
  for (const field of required) {
    if (!config[field as keyof DeploymentIAMConfig]) {
      console.error(`[CONFIG] Missing required IAM field: ${field}`);
      return false;
    }
  }
  
  // Validate URL format
  try {
    new URL(config.url);
  } catch {
    console.error(`[CONFIG] Invalid IAM URL format: ${config.url}`);
    return false;
  }
  
  return true;
}

/**
 * Log configuration (without sensitive data) for debugging
 */
export function logIAMConfig(): void {
  const config = getIAMConfig();
  console.log('[CONFIG] IAM Configuration loaded:', {
    url: config.url,
    grantType: config.grantType,
    scope: config.scope,
    clientId: config.clientId,
    clientSecret: '***' + config.clientSecret.slice(-4), // Show only last 4 chars
    tenantName: config.tenantName,
    timeout: config.timeout,
    retryAttempts: config.retryAttempts
  });
}

// Export the configuration instance
export const iamConfig = getIAMConfig();