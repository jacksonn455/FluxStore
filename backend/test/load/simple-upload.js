import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  iterations: 3,
};

const csvContent = `name;price;expiration
Product 1;100.00;2024-12-31
Product 2;200.00;2024-11-30`;

export default function () {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.csv"',
    'Content-Type: text/csv',
    '',
    csvContent,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const params = {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    timeout: '30s',
  };

  const response = http.post(
    'http://localhost:3000/api/products/upload',
    body,
    params,
  );

  console.log(`Status: ${response.status}`);
  console.log(`Response: ${response.body}`);

  check(response, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
}
