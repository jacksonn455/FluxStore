import http from 'k6/http';
import { sleep } from 'k6';

// Load CSV file
const fileData = open(
  'C:/projetos/FluxStore/fluxstore/backend/test/load/data/products-1000.csv',
  'b' // 'b' indicates it should be read as binary
);

export let options = {
  vus: 2, // Reduced to avoid overloading rate limit (2 req/min)
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be < 5s
    http_req_failed: ['rate<0.1'], // Failure rate < 10%
  },
};

export default function () {
  try {
    if (!fileData) {
      console.error('Failed to open CSV file');
      return;
    }

    // Create multipart/form-data payload
    const formData = {
      file: http.file(fileData, 'products-test.csv', 'text/csv'),
    };

    // Send POST request with multipart/form-data
    const response = http.post(
      'http://localhost:3000/products/upload',
      formData,
      {
        headers: {
          // Don't set Content-Type manually for multipart
          // K6 will configure automatically with boundary
        },
        timeout: '60s', // 60 second timeout for long processes
      }
    );

    // Detailed response logging
    console.log(`Status: ${response.status}`);
    console.log(`Duration: ${response.timings.duration}ms`);
    
    // Check for success status codes (200 or 201)
    if (response.status === 200 || response.status === 201) {
      console.log(`Success rate: 100%`);
      
      // Parse response to get processing info
      try {
        const responseData = JSON.parse(response.body);
        if (responseData.result) {
        }
      } catch (parseError) {
        console.log('Response body is not valid JSON');
      }
    } else {
      console.error(`Error Response: ${response.body}`);
    }

    // Wait 35 seconds between requests to respect rate limit (2 req/min)
    // With 2 VUs, each VU will make 1 request every 70 seconds
    sleep(35);
    
  } catch (e) {
    console.error(`Exception: ${e.message}`);
  }
}

// Setup function to verify server is responding
export function setup() {
  console.log('Starting CSV upload test...');
  
  // Test basic connectivity
  const response = http.get('http://localhost:3000/products/count');
  
  if (response.status !== 200) {
    console.error('Server is not responding correctly');
    return null;
  }
  
  console.log('Server is online and responding');
  return { serverReady: true };
}

// Teardown function for cleanup
export function teardown(data) {
  if (data && data.serverReady) {
    console.log('Test completed');
  }
}