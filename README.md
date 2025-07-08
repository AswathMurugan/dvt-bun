# JavaScript Executor API

A secure TypeScript backend application that executes JavaScript code using Bun runtime and VM2 sandboxing. This API allows safe execution of JavaScript functions with input parameters, including support for bundled code with HTTP libraries like axios.

## Features

- 🔒 **Secure Execution**: Uses VM2 sandbox for isolated JavaScript execution
- ⚡ **Fast Runtime**: Built with Bun for high performance
- 🌐 **HTTP Support**: Full axios and fetch API support in sandbox
- 📦 **Bundled Code**: Handles ESbuild/webpack bundled JavaScript
- ⏱️ **Performance Tracking**: Execution time monitoring
- 🧹 **Code Cleanup**: Automatic export statement removal
- 🔄 **Async Support**: Promise and async/await function execution

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Node.js 18+ (for compatibility)

## Installation

### Option 1: Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd dvt-bun
```

2. Install dependencies:
```bash
bun install
```

3. Start the development server:
```bash
bun run dev
```

4. Or start the production server:
```bash
bun run start
```

The server will start on `http://localhost:3000`

### Option 2: Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd dvt-bun
```

2. Build the Docker image:
```bash
docker build -t js-executor-api .
```

3. Run the container:
```bash
docker run -p 3000:3000 js-executor-api
```

4. Or use docker-compose (create docker-compose.yml):
```yaml
version: '3.8'
services:
  js-executor:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Then run:
```bash
docker-compose up -d
```

The server will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### GET /
Returns API information and usage documentation.

**Response:**
```json
{
  "message": "JavaScript Executor API",
  "endpoints": {
    "POST /execute": "Execute JavaScript function with parameters"
  },
  "usage": {
    "format": {
      "code": "JavaScript code with function definition",
      "input": "Array of parameters to pass to the function",
      "functionName": "Name of the function to call"
    },
    "example": {
      "code": "async function main(a, b) { return a + b; }",
      "input": [5, 10],
      "functionName": "main"
    }
  }
}
```

#### POST /execute
Executes JavaScript code and returns the direct result.

**Request Body:**
```json
{
  "code": "string",
  "input": "array",
  "functionName": "string"
}
```

**Response Headers:**
- `X-Execution-Time`: Execution time in milliseconds (e.g., `12.34ms`)

**Success Response:**
```
Status: 200 OK
Headers:
  Content-Type: application/json
  X-Execution-Time: 3.25ms
Body: <direct function result>
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

## Usage Examples

### Basic Function Execution

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function add(a, b) { return a + b; }",
    "input": [5, 10],
    "functionName": "add"
  }'
```

**Response:**
```
15
```

### Async Function with HTTP Request

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "async function fetchData(url) { const response = await fetch(url); return response.json(); }",
    "input": ["https://api.github.com/users/octocat"],
    "functionName": "fetchData"
  }'
```

### Array Processing

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function processArray(arr, multiplier) { return arr.map(x => x * multiplier); }",
    "input": [[1, 2, 3, 4], 2],
    "functionName": "processArray"
  }'
```

**Response:**
```json
[2, 4, 6, 8]
```

### Object Manipulation

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function createUser(name, age, email) { return { id: Date.now(), name, age, email, createdAt: new Date().toISOString() }; }",
    "input": ["John Doe", 30, "john@example.com"],
    "functionName": "createUser"
  }'
```

### Bundled Code with Export Statements

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "async function main(a, b) { return a + b; } export { main as default };",
    "input": [15, 25],
    "functionName": "main"
  }'
```

## Supported JavaScript Features

### Core JavaScript
- All ES2022+ features
- Async/await and Promises
- Classes and modules (execution only)
- Arrow functions and destructuring

### Built-in APIs
- `fetch()` - HTTP requests
- `XMLHttpRequest` - Legacy HTTP requests  
- `setTimeout/setInterval` - Timers
- `Promise` - Async operations
- `URL/URLSearchParams` - URL handling
- `console` - Logging (prefixed with `[VM]`)

### HTTP Libraries
- ✅ axios (fully supported)
- ✅ fetch API
- ✅ XMLHttpRequest
- ✅ Any bundled HTTP library

### Restrictions
- No file system access
- No process manipulation
- 5-second execution timeout
- Sandboxed environment

## Project Structure

```
dvt-bun/
├── src/
│   ├── server.ts              # Main server setup
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── routes/
│   │   └── execute.ts        # API endpoint handlers
│   └── services/
│       └── jsExecutor.ts     # JavaScript execution service
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── test.ts                  # Test cases
└── README.md               # This file
```

## Development

### Available Scripts

```bash
# Start development server with watch mode
bun run dev

# Start production server
bun run start

# Build for production
bun run build

# Type checking
bun run type-check

# Run tests
bun run test.ts
```

### Docker Commands

```bash
# Build the Docker image
docker build -t js-executor-api .

# Run the container
docker run -p 3000:3000 js-executor-api

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Rebuild and restart
docker-compose up --build -d
```

### Testing

Run the test suite:

```bash
# Start the server first
bun run dev

# In another terminal, run tests
bun run test.ts
```

The test suite includes:
- Basic function execution
- Async operations
- Array processing
- HTTP requests
- Export statement cleanup
- Error handling

### Code Architecture

#### VM2 Sandbox Configuration
The executor uses VM2 with a comprehensive sandbox that includes:

- **HTTP Support**: fetch, XMLHttpRequest, axios compatibility
- **Global Objects**: window, global, document definitions
- **Timer Functions**: setTimeout, setInterval, clearTimeout, clearInterval
- **Console Logging**: Prefixed with `[VM]` for debugging
- **Environment Variables**: NODE_ENV and process.nextTick

#### Security Features
- **Isolated Execution**: Complete separation from host environment
- **Timeout Protection**: 5-second maximum execution time
- **Memory Isolation**: No access to host memory or variables
- **API Restrictions**: Limited to provided sandbox APIs

#### Code Cleanup
Automatically removes export statements from code end:
- `export { functionName as default };`
- `export default functionName;`
- `export { func1, func2 };`
- `module.exports = functionName;`

## Performance

### Execution Time
- Lightweight functions: < 10ms
- HTTP requests: 100-1000ms (network dependent)
- Complex operations: varies by code complexity

### Limitations
- 5-second timeout per execution
- Memory usage limited by VM2 sandbox
- No persistent state between executions

## Troubleshooting

### Common Issues

#### "Function not defined" Error
```json
{ "error": "Function 'functionName' is not defined or not a function" }
```
**Solution**: Ensure the function name matches exactly and the function is defined in the code.

#### Timeout Errors
```json
{ "error": "Code execution timed out (max 5 seconds)" }
```
**Solution**: Optimize code or break into smaller functions. Check for infinite loops.

#### HTTP Request Failures
```json
{ "error": "Network request failed" }
```
**Solution**: Verify the URL is accessible and the server is responding.

### Debug Mode

Check execution time in response headers:
```bash
curl -I -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"code":"...","input":[],"functionName":"test"}'
```

Look for `X-Execution-Time` header for performance debugging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure TypeScript compilation passes
5. Submit a pull request

## License

ISC License - see package.json for details.

## Security

This API is designed for controlled environments. For production use:
- Add authentication/authorization
- Implement rate limiting
- Monitor resource usage
- Review executed code
- Use HTTPS in production

## Support

For issues and questions:
- Check the troubleshooting section
- Review test cases in `test.ts`
- Open an issue in the repository