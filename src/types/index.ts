/**
 * Request payload for POST /execute endpoint
 */
export interface ExecuteRequest {
  /** JavaScript code containing the function to execute */
  code: string;
  /** Array of parameters to pass to the function */
  input: any[];
  /** Name of the function to call from the code (defaults to 'main') */
  functionName?: string;
}

/**
 * Response payload for POST /execute endpoint
 */
export interface ExecuteResponse {
  /** Direct result from function execution (success only) */
  result?: any;
  /** Error message if execution failed */
  error?: string;
}

export interface ApiResponse {
  message: string;
  endpoints: Record<string, string>;
  usage?: {
    format: {
      code: string;
      input: string;
      functionName: string;
    };
    example: {
      code: string;
      input: any[];
      functionName: string;
    };
  };
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}