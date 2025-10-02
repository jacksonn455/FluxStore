import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const csvData = `name;price;expiration\r
Calypso - Lemonade;115.55;2023-01-11\r
Cheese - Grana Padano;163.88;2023-01-14\r
Cape Capensis - Fillet;189.72;2023-01-09`;

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const payload = `
--${boundary}
Content-Disposition: form-data; name="file"; filename="test-products.csv"
Content-Type: text/csv

${csvData}
--${boundary}--
`.trim();

  const params = {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    timeout: '30s',
  };

  const response = http.post(
    'http://localhost:3000/products/upload',
    payload,
    params,
  );

  console.log(`Status: ${response.status}`);

  if (response.status >= 400) {
    console.log(`Error response: ${response.body}`);
  }

  check(response, {
    'status is successful': (r) => r.status >= 200 && r.status < 300,
    'response time reasonable': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
