import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NewRelicService } from './newrelic.service';

export function MeasureExecutionTime(metricName?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const newRelicService: NewRelicService = (this as any).newRelicService;

      try {
        const result = await method.apply(this, args);
        const executionTime = Date.now() - startTime;

        if (newRelicService) {
          const metric =
            metricName || `${target.constructor.name}/${propertyName}`;
          newRelicService.recordMetric(metric, executionTime);
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;

        if (newRelicService) {
          const metric =
            metricName || `${target.constructor.name}/${propertyName}`;
          newRelicService.recordMetric(metric, executionTime);
          newRelicService.recordError(error, {
            method: propertyName,
            className: target.constructor.name,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}

@Injectable()
export class NewRelicInterceptor {
  constructor(private readonly newRelicService: NewRelicService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.newRelicService.recordApiResponseTime(
            request.route?.path || request.url,
            request.method,
            duration,
            response.statusCode,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();

          this.newRelicService.recordApiResponseTime(
            request.route?.path || request.url,
            request.method,
            duration,
            response.statusCode || 500,
          );

          this.newRelicService.recordError(error, {
            endpoint: request.url,
            method: request.method,
            statusCode: response.statusCode,
          });
        },
      }),
    );
  }
}
