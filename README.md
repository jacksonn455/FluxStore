# FluxStore: Product Management API - Backend

A back-end RESTful API developed with Node.js and NestJS for comprehensive product management with real-time currency conversion and scalable data processing. This project was implementing a robust solution that can upload, process, and store CSV files containing product data with support for up to 200k+ rows.

The application applies modern backend architecture patterns, including message queues, caching strategies, and robust data validation, designed to easily scale for enterprise-level requirements.

## Features

This API was developed with a focus on scalability, performance, and modern software development practices. All core objectives have been successfully implemented:

### **Backend**
*   **CSV Upload & Processing:** Full support for CSV files with up to 200k+ rows with scalable architecture
*   **Database Storage:** All products stored with complete validation (all fields required and present)
*   **Multi-Currency Integration:** Real-time exchange rates from external API with 5+ currencies stored at upload time
*   **Advanced API Endpoints:** Complete filtering and sorting by name, price, and expiration fields
*   **Enterprise-Scale Architecture:** Built to easily scale beyond 200k rows with message queues and batch processing
*   **Comprehensive Testing:** Unit and integration tests with Jest for reliable codebase

### **Architecture & Implementation:**

*   **Product Management & Currency Integration:**
    *   Full CRUD operations for **Products** with automatic currency conversion.
    *   CSV import functionality with batch processing for large datasets.
    *   Real-time **Exchange Rate** integration with multiple currencies support.
    *   Advanced data validation and error handling for all entities.

*   **Architecture & Performance:**
    *   **Clean Architecture** principles with separation of concerns.
    *   **Microservices-ready** design with modular structure.
    *   **Asynchronous processing** with RabbitMQ for CSV import operations.
    *   **Redis caching** for improved response times and reduced database load.
    *   **Pagination** and **filtering** for optimized data retrieval.

*   **Message Queue System:**
    *   **RabbitMQ** integration for background CSV processing.
    *   Automatic retry mechanism with dead letter queues.
    *   Queue monitoring and health check endpoints.
    *   Fallback processing when message queue is unavailable.

*   **Data Processing & Validation:**
    *   **CSV parsing** with comprehensive error reporting.
    *   **Batch processing** for optimal database performance.
    *   Data validation with detailed error messages and line tracking.
    *   **MongoDB** integration with Mongoose ODM for flexible schema management.

*   **Caching & Performance:**
    *   **Redis** integration for high-performance data caching.
    *   **Smart caching strategies** with configurable TTL.
    *   Cache invalidation and update mechanisms.
    *   Performance monitoring and metrics collection.

*   **External API Integration:**
    *   Real-time **currency exchange rates** from external APIs.
    *   Configurable currency selection and conversion.
    *   API rate limiting and error handling.
    *   Automatic fallback mechanisms for API failures.

*   **Monitoring & Debugging:**
    *   Comprehensive **logging** with structured format and log levels.
    *   **Health check endpoints** for system monitoring.
    *   **Error tracking** and detailed exception handling.
    *   Development and production environment configurations.

## Technologies Used

*   **Core:** Node.js, TypeScript, NestJS
*   **Database:** MongoDB, Mongoose ODM
*   **Message Queue:** RabbitMQ (amqplib)
*   **Caching:** Redis (ioredis)
*   **Data Processing:** CSV-Parser for file processing
*   **HTTP Client:** Axios for external API calls
*   **Validation:** Class-validator, Class-transformer
*   **Testing:** Jest, Supertest for unit and integration tests
*   **Stress & Load Testing:** K6 for performance, load, and stress testing with CSV datasets up to 200k+ rows
*   **Configuration:** @nestjs/config for environment management
*   **Logging:** Built-in NestJS Logger with structured output
*   **Monitoring:** Monitoring and observability features powered by New Relic
*   **API Documentation:** Swagger/OpenAPI documentation that provides interactive exploration of endpoints
*   **Development:** Nodemon, TypeScript compiler
*   **Package Management:** npm

## How to Run the Project

### Prerequisites
- Node.js
- MongoDB (cloud instance)
- Redis server
- RabbitMQ server

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/fluxstore.git
    ```

2.  **Enter the project folder:**
    ```bash
    cd fluxstore
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Setup environment variables:**
    ```bash
    cp .env.example .env
    ```
    Configure your environment variables:
    ```env
    # Database
    MONGODB_URI=mongodb://localhost:27017/fluxstore
    
    # Redis
    REDIS_HOST=localhost
    REDIS_PORT=6379
    REDIS_PASSWORD=your_redis_password
    
    # RabbitMQ
    RABBITMQ_URL=amqp://admin:password@localhost:5672
    
    # External APIs
    EXCHANGE_RATE_API_KEY=your_api_key
    EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest
    
    # Application
    PORT=3000
    NODE_ENV=development
    ```

5.  **Run the application:**
    ```bash
    # Development mode
    npm run start:dev
    
    # Production mode
    npm run start:prod
    ```

The API will be available at `http://localhost:3000`.

### Testing
- The project includes comprehensive test coverage using Jest testing framework:

## Test Structure
- Unit Tests: Individual service methods and utilities
- Integration Tests: API endpoints and database interactions
- E2E Tests: Full workflow testing

## Test Coverage
- The test suite covers:
- Product service methods (CRUD operations)
- CSV parsing and validation
- Currency conversion logic
- API endpoints validation
- Error handling scenarios
- Database interactions

## Test Environment
- Tests run with a dedicated test database and mocked external dependencies to ensure reliable and isolated test execution.

### Stress and Load Testing with K6
- Ensures FluxStore can handle CSV files with 200k+ rows using K6.
- Verifies performance, scalability, and system stability under high load.

**Example:**
```
k6 run test/load/stress-test.js
```


### Monitoring
- This application is integrated with New Relic APM for comprehensive performance monitoring and observability.
- Real-time Performance Tracking: Monitor API response times, throughput, and error rates
- Custom Business Metrics: Track CSV processing performance and database operations
- Distributed Tracing: End-to-end transaction tracing across services
- Error Analytics: Automatic error tracking with detailed context
- Infrastructure Monitoring: Server metrics, memory usage, and CPU performance

## Main Metrics Tracked
- CSV Processing: Upload operations, processing time, success/error rates
- API Performance: Endpoint response times and throughput
- Database Operations: Query performance and batch processing metrics
- Custom Events: Business-specific analytics for CSV processing and product management

## Monitoring Benefits
- Fast Issue Resolution: Identify performance bottlenecks in seconds
- Proactive Alerts: Detect issues before they affect users
- Business Insights: Understand API usage patterns and processing efficiency
- The New Relic agent starts automatically with your application and requires minim

## Rate Limiting & Security

The API implements comprehensive rate limiting to protect critical endpoints from abuse and ensure system stability, particularly for resource-intensive operations like CSV uploads.

### Rate Limiting Configuration

The application uses `@nestjs/throttler` with Redis-backed storage for distributed rate limiting across multiple server instances.

#### Endpoint-Specific Limits

| Endpoint | Limit | Time Window | Purpose |
|----------|-------|-------------|---------|
| `POST /products/upload` | 2 requests | 1 minute | Prevent CSV upload abuse |
| `GET /products` | 100 requests | 1 minute | Allow smooth data browsing |
| `GET /products/count` | No limit | - | Lightweight endpoint |

### Implementation Details

#### CSV Upload Protection
The CSV upload endpoint has strict rate limiting due to its resource-intensive nature:
- **2 uploads per minute** - Prevents system overload from large file processing
- **IP-based tracking** - Individual limits per client IP address
- **Graceful error handling** - Clear error messages when limits are exceeded

#### Response Headers
When rate limits are applied, the API returns informative headers:
```
X-RateLimit-Limit: 2
X-RateLimit-Remaining: 1
X-RateLimit-Reset: 1640995200
```

#### Error Response Format
```json
{
  "message": "Rate limit exceeded for CSV upload from IP: 192.168.1.100. Please wait before trying again.",
  "error": "Too Many Requests",
  "statusCode": 429
}
```

### Configuration

Rate limiting can be configured through environment variables:

```env
# Rate Limiting Configuration
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
CSV_UPLOAD_LIMIT_PER_MINUTE=2
CSV_UPLOAD_LIMIT_PER_HOUR=10
CSV_UPLOAD_LIMIT_PER_DAY=50
```

### Benefits

- **DoS Protection**: Prevents denial of service attacks on resource-intensive endpoints
- **Fair Usage**: Ensures equitable access to API resources across all clients
- **System Stability**: Maintains consistent performance under high load
- **Resource Management**: Protects database and external API calls from abuse
- **Monitoring**: Tracks usage patterns and identifies potential security threats

### Bypass for Development

During development, rate limiting can be temporarily disabled by setting:
```env
NODE_ENV=development
THROTTLE_SKIP_IF=true
```

This protection ensures the FluxStore API remains stable and responsive even when processing large CSV files with 200k+ rows while maintaining fair access for all users.

### API Documentation

The FluxStore API includes comprehensive Swagger/OpenAPI documentation that provides interactive exploration of all available endpoints.

1.  **Documentation:**
    ```bash
    http://localhost:3000/api
    ```

## Swagger Features
- Interactive API Explorer: Test endpoints directly from the browser
- Request/Response Schemas: View detailed model definitions for all DTOs
- Authentication Support: Configure API keys and headers
- Real-time Testing: Execute API calls with sample data
- Downloadable Specifications: Export OpenAPI specification in JSON format

## Available Documentation Sections
- Products API: Complete CRUD operations for product management
- CSV Upload: File upload endpoint with validation details
- Exchange Rates: Currency conversion endpoints and schemas
- Health Checks: System monitoring endpoin

### Docker Setup

1.  **Using Docker Compose:**
    ```bash
    docker-compose up -d
    ```

This will start all required services (MongoDB, Redis, RabbitMQ) and the application.

## Main Endpoints

| Method | Endpoint                    | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| `POST` | `/products/upload`  | Import products from CSV file                  |
| `GET`  | `/products`         | List all products with pagination and filters |


### Query Parameters for Products

**GET /api/products** supports the following query parameters:

- `name` - Filter by product name (case-insensitive)
- `minPrice` - Filter by minimum price
- `maxPrice` - Filter by maximum price  
- `expiration` - Filter by expiration date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 1000)
- `sortField` - Sort by field (name, price, expiration)
- `sortOrder` - Sort order (asc, desc)

**Example:**
```
GET /products?name=apple&minPrice=10&maxPrice=50&page=1&limit=20&sortField=price&sortOrder=asc
```

## CSV Import Format

The CSV import functionality expects files with the following format:

```csv
name;price;expiration
Apple iPhone 13;$999.99;12/31/2024
Samsung Galaxy S22;$899.99;06/15/2025
```

**Requirements:**
- Semicolon (`;`) separated values
- Headers: `name`, `price`, `expiration`
- Price format: Can include `$` symbol and commas
- Date format: MM/DD/YYYY

## Project Structure

```
src/
├── main.ts
├── app.module.ts 
├── common/
│   ├── config/
│   │   ├── redis/
│   │   └── rabbitmq/ 
├── modules/
│   ├── products/
│   │   ├── controllers/ 
│   │   ├── services/
│   │   ├── entities/
│   │   ├── dtos/
│   │   └── modules/
│   └── exchange-rates/
│       ├── controllers/
│       ├── services/
│       ├── dtos/
│       └── modules/
├── data/
└── test/
```

## Environment Variables

| Variable                    | Description                          | Default                              |
|----------------------------|--------------------------------------|--------------------------------------|
| `PORT`                     | Application port                     | `3000`                              |
| `NODE_ENV`                 | Environment mode                     | `development`                       |
| `MONGODB_URI`              | MongoDB connection string            | `mongodb://localhost:27017/fluxstore` |
| `REDIS_HOST`               | Redis server host                    | `localhost`                         |
| `REDIS_PORT`               | Redis server port                    | `6379`                              |
| `REDIS_PASSWORD`           | Redis password                       | -                                   |
| `RABBITMQ_URL`             | RabbitMQ connection URL              | `amqp://admin:password@localhost:5672` |
| `EXCHANGE_RATE_API_KEY`    | Exchange rate API key                | -                                   |
| `EXCHANGE_RATE_API_URL`    | Exchange rate API base URL           | -                                    |
| `NEW_RELIC_APP_NAME`       | New relic API name                   | -                                   |
| `NEW_RELIC_LICENSE_KEY`    |  New relic API Key                   | -                                    |

## API Response Format

### Success Response
```json
{
	"data": [
		{
			"_id": "68d5721688eeba29b321cb08",
			"name": "Calypso - Lemonade #(4026987913289674)",
			"price": 115.55,
			"expiration": "2023-01-11T03:00:00.000Z",
			"__v": 0,
			"createdAt": "2025-09-25T16:47:18.230Z",
			"updatedAt": "2025-09-25T16:47:18.230Z",
			"currencyConversions": {
				"EUR": 98.33,
				"GBP": 85.85,
				"JPY": 17171.89,
				"CAD": 160.61,
				"AUD": 175.64,
				"BRL": 611.26
			},
			"exchangeRates": {
				"date": "2025-09-25T16:41:12.800Z",
				"rates": {
					"EUR": 0.851,
					"GBP": 0.743,
					"JPY": 148.61,
					"CAD": 1.39,
					"AUD": 1.52,
					"BRL": 5.29
				}
			}
		}
  ],
"pagination": {
  "page": 3,
  "limit": 5,
  "total": 913,
  "totalPages": 183
}
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "price",
        "message": "Price must be a positive number"
      }
    ]
  }
}
```

## CSV Import Response
```json
{
	"message": "File processed successfully",
	"success": 913,
	"errors": 87
}
```

## Performance Features

*   **Redis Caching:** Frequently accessed data cached with configurable TTL
*   **Database Indexing:** Optimized MongoDB indexes for faster queries
*   **Batch Processing:** Large datasets processed in configurable batches
*   **Connection Pooling:** Optimized database connection management
*   **Memory Management:** Efficient memory usage for large file processing

## Development Scripts

```bash
# Development
npm run start:dev
npm run start:debug 

# Testing
npm npm test -- --config=package.json test/src/modules/exchange-rates/services/exchange-rates.service.spec.ts
npm test -- --config=package.json test/src/modules/products/services/products.service.spec.ts

# Stress Test
k6 run test/load/stress-test.js

# Code Quality
npm run lint
npm run format
```

# FluxStore: Product Management Frontend

A modern React-based frontend application for managing products with real-time data synchronization. This application provides an intuitive interface for uploading CSV files, browsing products with advanced filtering, and monitoring real-time data processing.

## Features

### Core Functionality

*   **CSV File Upload**: Drag-and-drop interface for uploading product data files.
*   **Real-time Processing Monitoring**: Live progress tracking during file processing.
*   **Advanced Product Table**: Comprehensive data browsing with pagination and sorting.
*   **Multi-currency Display**: Automatic currency conversion display (EUR, GBP, JPY, CAD, AUD, BRL).
*   **Responsive Design**: Optimized for desktop and mobile devices.

### User Experience

*   **Progress Indicators**: Real-time upload and processing status.
*   **Smart Polling**: Automatic data synchronization with optimized intervals.
*   **Error Handling**: Comprehensive error messages and recovery options.
*   **Filtering & Search**: Advanced filtering by name, price range, and expiration date.
*   **Sorting Options**: Multi-column sorting with ascending/descending order.

### Technical Features

*   **TypeScript**: Full type safety and better developer experience.
*   **Material-UI**: Modern, accessible component library.
*   **Real-time Updates**: Smart polling mechanism with configurable intervals.
*   **State Management**: Efficient React state management with hooks.
*   **API Integration**: Robust error handling and loading states.

## Technologies Used

| Category         | Technology                               |
| :--------------- | :--------------------------------------- |
| **Framework**    | React 18 with TypeScript                 |
| **UI Library**   | Material-UI (MUI) v5                     |
| **HTTP Client**  | Axios for API communication              |
| **Build Tool**   | Vite for fast development and building   |
| **State Management** | React Hooks (useState, useEffect, useCallback) |
| **Styling**      | Emotion (MUI's styling solution)         |
| **Icons**        | Material-UI Icons                        |
| **Development**  | ESLint, Prettier, TypeScript compiler    |

## Project Structure

```text
src/
├── components/
│   ├── FileUpload/
│   │   ├── FileUpload.tsx
│   │   └── FileUpload.test.tsx
│   ├── ProductTable/
│   │   ├── ProductTable.tsx
│   │   └── ProductTable.test.tsx
│   └── common/
│       ├── LoadingSpinner.tsx
│       └── ErrorMessage.tsx
├── services/
│   ├── api.ts
│   └── productService.ts
├── types/
│   └── index.ts
├── hooks/
│   ├── useProducts.ts
│   └── usePolling.ts
├── utils/
│   ├── formatters.ts
│   └── validators.ts
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

## Author

<img src="https://avatars1.githubusercontent.com/u/46221221?s=460&u=0d161e390cdad66e925f3d52cece6c3e65a23eb2&v=4" width=115>  

<sub>@jacksonn455</sub>