/**
 * Configuration Loader for YAML-based application configuration
 * Supports multiple profiles and environment variable substitution
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Application configuration interface
 */
export interface ApplicationConfig {
  app: {
    name: string;
    version: string;
    environment: string;
    port: number;
    host: string;
  };
  server: {
    host: string;
    port: number;
    timeout: number;
    keepAliveTimeout: number;
  };
  iam: {
    url: string;
    grantType: string;
    scope: string;
    clientId: string;
    clientSecret: string;
    tenantName: string;
    timeout: number;
    retryAttempts: number;
  };
  execution: {
    timeout: number;
    maxCodeLength: number;
    sandbox: {
      allowHttp: boolean;
      allowConsole: boolean;
      allowTimers: boolean;
    };
  };
  nodeModulesPath: string;
  dvtStorageHost: string;
  logging: {
    level: string;
    format: string;
    enableRequestLogging: boolean;
    enableExecutionLogging: boolean;
  };
  security: {
    enableCors: boolean;
    corsOrigins: string;
    enableRateLimit: boolean;
    rateLimitRequests: number;
    rateLimitWindow: number;
  };
  health: {
    enabled: boolean;
    endpoint: string;
    timeout: number;
  };
}

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: ApplicationConfig | null = null;
  private configPath: string;

  private constructor() {
    // Determine config file path - check multiple locations
    this.configPath = this.findConfigFile();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Find configuration file in multiple locations
   */
  private findConfigFile(): string {
    const possiblePaths = [
      // Kubernetes ConfigMap mount point
      '/etc/config/application.yml',
      // Docker volume mount
      '/app/config/application.yml',
      // Local development
      path.join(process.cwd(), 'application.yml'),
      // Default fallback
      path.join(__dirname, '../../application.yml')
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        logger.info('CONFIG Found configuration file', {}, { configPath });
        return configPath;
      }
    }

    throw new Error(`Configuration file not found. Searched paths: ${possiblePaths.join(', ')}`);
  }

  /**
   * Load and parse configuration with profile support
   */
  public loadConfig(): ApplicationConfig {
    if (this.config) {
      return this.config;
    }

    try {
      const environment = process.env.NODE_ENV || 'development';
      
      // Load base configuration
      const baseConfig = this.loadYamlFile(this.configPath);
      
      // Load environment-specific configuration if exists
      const envConfigPath = this.configPath.replace('.yml', `-${environment}.yml`);
      let envConfig = {};
      
      if (fs.existsSync(envConfigPath)) {
        logger.info('CONFIG Loading environment config', {}, { envConfigPath });
        envConfig = this.loadYamlFile(envConfigPath);
      }

      // Merge configurations (environment overrides base)
      const mergedConfig = this.deepMerge(baseConfig, envConfig);
      
      // Substitute environment variables
      const finalConfig = this.substituteEnvironmentVariables(mergedConfig);
      
      // Validate configuration
      this.validateConfig(finalConfig);
      
      this.config = finalConfig as ApplicationConfig;
      
      logger.info('CONFIG Configuration loaded successfully for environment', {}, { environment });
      return this.config;
      
    } catch (error) {
      logger.error('CONFIG Failed to load configuration', {}, { error });
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load YAML file and parse it
   */
  private loadYamlFile(filePath: string): any {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return yaml.load(fileContent) as any;
    } catch (error) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Substitute environment variables in configuration
   * Supports syntax: ${VAR_NAME:default_value}
   */
  private substituteEnvironmentVariables(config: any): any {
    const substitute = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj.replace(/\${([^}:]+)(?::([^}]*))?\}/g, (match, varName, defaultValue) => {
          const envValue = process.env[varName];
          if (envValue !== undefined) {
            // Convert string values to appropriate types
            if (envValue === 'true') return true;
            if (envValue === 'false') return false;
            if (/^\d+$/.test(envValue)) return parseInt(envValue, 10);
            if (/^\d*\.\d+$/.test(envValue)) return parseFloat(envValue);
            return envValue;
          }
          if (defaultValue !== undefined) {
            // Convert default values to appropriate types
            if (defaultValue === 'true') return true;
            if (defaultValue === 'false') return false;
            if (/^\d+$/.test(defaultValue)) return parseInt(defaultValue, 10);
            if (/^\d*\.\d+$/.test(defaultValue)) return parseFloat(defaultValue);
            return defaultValue;
          }
          return match; // Keep original if no env var or default
        });
      } else if (Array.isArray(obj)) {
        return obj.map(substitute);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
          result[key] = substitute(obj[key]);
        }
        return result;
      }
      return obj;
    };

    return substitute(config);
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: any): void {
    const requiredPaths = [
      'app.name',
      'app.environment',
      'iam.url',
      'iam.clientId',
      'iam.clientSecret',
      'execution.timeout',
      'nodeModulesPath',
      'dvtStorageHost'
    ];

    for (const path of requiredPaths) {
      if (!this.getNestedValue(config, path)) {
        throw new Error(`Missing required configuration: ${path}`);
      }
    }

    // Validate IAM URL format
    try {
      new URL(config.iam.url);
    } catch {
      throw new Error(`Invalid IAM URL format: ${config.iam.url}`);
    }

    // Validate numeric values
    if (config.execution.timeout <= 0) {
      throw new Error('Execution timeout must be greater than 0');
    }

    logger.info('CONFIG Configuration validation passed');
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get current configuration
   */
  public getConfig(): ApplicationConfig {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Reload configuration (useful for hot reloading)
   */
  public reloadConfig(): ApplicationConfig {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * Log configuration (without sensitive data)
   */
  public logConfig(): void {
    const config = this.getConfig();
    const safeConfig = JSON.parse(JSON.stringify(config));
    
    // Mask sensitive data
    if (safeConfig.iam?.clientSecret) {
      safeConfig.iam.clientSecret = '***' + safeConfig.iam.clientSecret.slice(-4);
    }
    
    logger.info('CONFIG Current configuration', {}, { safeConfig });
  }
}

/**
 * Export singleton instance and convenience functions
 */
export const configLoader = ConfigLoader.getInstance();
export const getConfig = (): ApplicationConfig => configLoader.getConfig();
export const reloadConfig = (): ApplicationConfig => configLoader.reloadConfig();
export const logConfig = (): void => configLoader.logConfig();