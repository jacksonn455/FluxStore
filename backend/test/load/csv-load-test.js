import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { open } from 'k6/fs';

const uploadDuration = new Trend('csv_upload_duration');
const successRate = new Rate('upload_success_rate');
const rowsProcessed = new Counter('total_rows_processed');

const stageConfig = {
  small: {
    file: 'products-1k.csv',
    vus: 5,
    duration: '3m',
    timeout: '30s',
  },
  medium: {
    file: 'products-10k.csv',
    vus: 3,
    duration: '5m',
    timeout: '60s',
  },
  large: {
    file: 'products-200k.csv',
    vus: 2,
    duration: '10m',
    timeout: '300s',
  },
  xlarge: {
    file: 'products-500k.csv',
    vus: 1,
    duration: '15m',
    timeout: '600s',
  },
};

const currentStage = __ENV.STAGE || 'small';
const config = stageConfig[currentStage];

export const options = {
  stages: [
    { duration: '1m', target: config.vus },
    { duration: config.duration, target: config.vus },
    { duration: '1m', target: 0 },
  ],

  thresholds: {
    http_req_duration: ['p(95)<60000'],
    http_req_failed: ['rate<0.05'],
    csv_upload_duration: ['p(95)<120000'],
  },
};

export function setup() {
  console.log(`🚀 Starting load test with stage: ${currentStage}`);
  console.log(`📁 Using file: ${config.file}`);

  try {
    const filePath = `test/load/data/${config.file}`;
    const fileContent = open(filePath, 'b');

    const estimatedRows = parseInt(config.file.split('-')[1]) || 1000;

    return {
      fileData: fileContent,
      fileName: config.file,
      stage: currentStage,
      estimatedRows: estimatedRows,
    };
  } catch (error) {
    console.error('Error loading CSV file:', error);
    throw error;
  }
}

export default function (data) {
  const { fileData, fileName, stage, estimatedRows } = data;

  const payload = {
    file: http.file(fileData, fileName, 'text/csv'),
  };

  const params = {
    timeout: stageConfig[stage].timeout,
    tags: {
      stage: stage,
      file: fileName,
      vu: __VU,
      iter: __ITER,
    },
  };

  const startTime = Date.now();

  const UPLOAD_URL = 'http://localhost:3000/api/products/upload';

  const response = http.post(UPLOAD_URL, payload, params);

  const uploadTime = Date.now() - startTime;
  uploadDuration.add(uploadTime);
  rowsProcessed.add(estimatedRows);

  const success = check(response, {
    'status is successful': (r) => r.status >= 200 && r.status < 300,
    'response time acceptable': (r) =>
      uploadTime < (stage === 'large' ? 180000 : 30000),
    'valid response format': (r) => {
      try {
        const json = r.json();
        return json && (json.success === true || json.processedCount > 0);
      } catch {
        return r.status === 200 || r.status === 201;
      }
    },
  });

  successRate.add(success);

  if (!success) {
    console.log(`❌ Upload failed (${stage}):`, {
      status: response.status,
      duration: `${uploadTime}ms`,
      error: response.body
        ? response.body.substring(0, 200)
        : 'No response body',
    });
  } else {
    console.log(`✅ Upload successful (${stage}): ${uploadTime}ms`);
  }

  const sleepTime = {
    small: 10,
    medium: 30,
    large: 60,
    xlarge: 120,
  }[stage];

  sleep(sleepTime);
}

export function handleSummary(data) {
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  console.log(`Stage: ${currentStage}`);
  console.log(
    `Success Rate: ${(1 - data.metrics.http_req_failed.values.rate) * 100}%`,
  );
  console.log(
    `95%ile Upload Duration: ${data.metrics.csv_upload_duration.values.p95}ms`,
  );
  console.log(
    `Total Rows Processed: ${data.metrics.total_rows_processed.values.count}`,
  );

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
