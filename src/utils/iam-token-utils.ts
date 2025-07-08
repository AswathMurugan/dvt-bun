/**
 * IAM Token Utility for managing authentication tokens
 * Converts Java HttpClient implementation to TypeScript fetch API
 */

/**
 * Configuration interface for IAM token service
 */
export interface IAMConfig {
  url: string;
  grantType: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  tenantName: string;
}

/**
 * Token response interface from IAM service
 */
export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Custom error class for token-related exceptions
 */
export class TokenException extends Error {
  public statusCode: number;
  public errorCode: number;

  constructor(statusCode: number, errorCode: number, message: string) {
    super(message);
    this.name = 'TokenException';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * IAM Token Utility Class
 * Handles authentication token generation and management
 */
export class IAMTokenUtils {
  private iamHost: string;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private grantType: string;

  constructor(config: IAMConfig) {
    this.iamHost = config.url.endsWith('/') ? config.url : config.url + '/';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scope = config.scope;
    this.grantType = config.grantType;
  }

  /**
   * Gets a new authentication token from IAM service
   * 
   * @param tenantName - The tenant identifier
   * @returns Promise resolving to Bearer token string (with "Bearer " prefix)
   * @throws TokenException if token generation fails
   */
  public async getNewToken(tenantName: string): Promise<string> {
    const iamURL = `${this.iamHost}apexiam/v1/auth/token?tenantId=${tenantName}`;
    
    // Prepare form data (equivalent to UrlEncodedFormEntity in Java)
    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('grant_type', this.grantType);
    formData.append('scope', this.scope);

    try {
      console.log(`[IAM] Requesting token for tenant: ${tenantName}`);
      
      const response = await fetch(iamURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData.toString()
      });

      // Check if response is null or status is not 200
      if (!response || response.status !== 200) {
        console.error(`[IAM] API Response error. Status: ${response?.status}, URL: ${iamURL}`);
        throw new TokenException(400, 4002, 'error while getting new token');
      }

      // Parse response as JSON
      let tokenResponse: TokenResponse;
      try {
        tokenResponse = await response.json() as TokenResponse;
      } catch (parseError) {
        console.error(`[IAM] Error parsing response:`, parseError);
        throw new TokenException(400, 4003, 'error while parsing token response');
      }

      // Check if token response is valid
      if (!tokenResponse || tokenResponse.error) {
        console.error(`[IAM] Error in token response:`, {
          error: tokenResponse?.error,
          error_description: tokenResponse?.error_description,
          status: response.status
        });
        throw new TokenException(400, 4003, 'error while getting new token');
      }

      // Validate access token presence
      if (!tokenResponse.access_token) {
        console.error(`[IAM] No access token in response:`, tokenResponse);
        throw new TokenException(400, 4003, 'access token not found in response');
      }

      console.log(`[IAM] Token generated successfully for tenant: ${tenantName}`);
      return `Bearer ${tokenResponse.access_token}`;

    } catch (error) {
      // Handle TokenException (already formatted)
      if (error instanceof TokenException) {
        throw error;
      }

      // Handle other errors (network, etc.)
      console.error('[IAM] Error while getting IAM token:', error);
      throw new TokenException(500, 5000, 'error while getting new token');
    }
  }

  /**
   * Creates IAMTokenUtils instance from configuration
   * 
   * @param config - IAM configuration object
   * @returns New IAMTokenUtils instance
   */
  public static fromConfig(config: IAMConfig): IAMTokenUtils {
    return new IAMTokenUtils(config);
  }
}

/**
 * Factory function to create IAM token utility with deployment configuration
 * 
 * @returns IAMTokenUtils instance with current environment configuration
 */
export function createIAMTokenUtils(): IAMTokenUtils {
  // Lazy import to avoid circular dependencies
  const { getIAMConfig } = require('../config/iam.config');
  const config = getIAMConfig();
  return IAMTokenUtils.fromConfig(config);
}

/**
 * Utility function to get token with deployment configuration
 * 
 * @param tenantName - Tenant identifier (optional, uses config default if not provided)
 * @returns Promise resolving to Bearer token string (with "Bearer " prefix)
 */
export async function getIAMToken(tenantName?: string): Promise<string> {
  const { getIAMConfig } = require('../config/iam.config');
  const config = getIAMConfig();
  const tokenUtils = createIAMTokenUtils();
  
  // Use provided tenant name or fall back to config default
  const targetTenant = tenantName || config.tenantName;
  return await tokenUtils.getNewToken(targetTenant);
}

/**
 * Utility function to get token for a specific configuration
 * Useful for testing or multi-tenant scenarios
 * 
 * @param config - Custom IAM configuration
 * @param tenantName - Tenant identifier
 * @returns Promise resolving to Bearer token string (with "Bearer " prefix)
 */
export async function getIAMTokenWithConfig(config: IAMConfig, tenantName?: string): Promise<string> {
  const tokenUtils = new IAMTokenUtils(config);
  const targetTenant = tenantName || config.tenantName;
  return await tokenUtils.getNewToken(targetTenant);
}