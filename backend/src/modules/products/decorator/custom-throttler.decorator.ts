import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

export const CsvUploadThrottle = () =>
  applyDecorators(
    Throttle({
      default: { limit: 2, ttl: 60000 },
    }),
  );

export const ApiQueryThrottle = () =>
  applyDecorators(
    Throttle({
      default: { limit: 100, ttl: 60000 },
    }),
  );

export const StrictCsvUploadThrottle = () =>
  applyDecorators(
    Throttle({
      default: { limit: 1, ttl: 120000 },
    }),
  );
