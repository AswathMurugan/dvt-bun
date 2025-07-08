import type { ExecuteRequest, ExecuteResponse } from './src/types';

interface TestCase {
  name: string;
  code: string;
  input: any[];
  functionName: string;
}

const testCases: TestCase[] = [
  {
    name: "Simple addition",
    code: "async function main(a, b) { return a + b; }",
    input: [5, 10],
    functionName: "main"
  },
  {
    name: "Array processing",
    code: "function processArray(arr, multiplier) { return arr.map(x => x * multiplier); }",
    input: [[1, 2, 3, 4], 2],
    functionName: "processArray"
  },
  {
    name: "String manipulation",
    code: "function createFullName(firstName, lastName) { return `${firstName} ${lastName}`; }",
    input: ["John", "Doe"],
    functionName: "createFullName"
  },
  {
    name: "Object calculation",
    code: "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
    input: [[{ price: 10 }, { price: 20 }, { price: 30 }]],
    functionName: "calculateTotal"
  },
  {
    name: "Async function",
    code: "async function delay(ms, value) { return new Promise(resolve => setTimeout(() => resolve(value), ms)); }",
    input: [100, "Hello World"],
    functionName: "delay"
  },
  {
    name: "Function with export statement",
    code: "async function main(a, b) { return a + b; } export { main as default };",
    input: [15, 25],
    functionName: "main"
  },
  {
    name: "Function with multiple export patterns",
    code: "function multiply(x, y) { return x * y; } export default multiply;",
    input: [7, 8],
    functionName: "multiply"
  },
  {
    name: "Function with export keyword in string (should preserve)",
    code: "function logMessage() { return 'This function will export data'; } export { logMessage as default };",
    input: [],
    functionName: "logMessage"
  },
  {
    name: "Function with export in comment (should preserve)",
    code: "function process() { /* TODO: export this later */ return 'processed'; } export default process;",
    input: [],
    functionName: "process"
  }
];

async function runTests(): Promise<void> {
  console.log("Testing JavaScript executor API...\n");
  
  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    
    try {
      const requestBody: ExecuteRequest = {
        code: testCase.code,
        input: testCase.input,
        functionName: testCase.functionName
      };
      
      const response = await fetch("http://localhost:3000/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      const executionTime = response.headers.get('X-Execution-Time');
      console.log("Result:", result);
      console.log("Execution Time:", executionTime);
      console.log("---");
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : 'Unknown error');
      console.log("---");
    }
  }
}

runTests().catch(console.error);