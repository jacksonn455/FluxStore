
import { Injectable, Inject, Logger } from '@nestjs/common';
import * as newrelic from 'newrelic';
import { NewRelicConfig } from './newrelic.config';

@Injectable()
export class NewRelicService {
  private readonly logger = new Logger(NewRelicService.name);

  constructor(private readonly newRelicConfig: NewRelicConfig) { }

  recordMetric(name: string, value: number): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.recordMetric(name, value);
      } catch (error) {
        this.logger.warn(`Failed to record metric ${name}: ${error.message}`);
      }
    }
  }

  recordEvent(eventType: string, attributes: Record<string, any>): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.recordCustomEvent(eventType, attributes);
      } catch (error) {
        this.logger.warn(`Failed to record event ${eventType}: ${error.message}`);
      }
    }
  }

  incrementCounter(name: string, count: number = 1): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.incrementMetric(name, count);
      } catch (error) {
        this.logger.warn(`Failed to increment counter ${name}: ${error.message}`);
      }
    }
  }

  async startBackgroundTransaction<T>(
    name: string,
    group: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.newRelicConfig.isEnabled) {
      return operation();
    }

    return newrelic.startBackgroundTransaction(name, group, async () => {
      try {

        newrelic.addCustomAttributes({
          backgroundJob: true,
          transactionName: name,
          transactionGroup: group
        });

        const result = await operation();
        return result;
      } catch (error) {
        this.recordError(error);
        throw error;
      }
    });
  }

  recordError(error: Error, customAttributes: Record<string, any> = {}): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.noticeError(error, customAttributes);
      } catch (nrError) {
        this.logger.warn(`Failed to record error in New Relic: ${nrError.message}`);
      }
    }
  }

  addCustomAttributes(attributes: Record<string, string | number | boolean>): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.addCustomAttributes(attributes);
      } catch (error) {
        this.logger.warn(`Failed to add custom attributes: ${error.message}`);
      }
    }
  }

  setTransactionName(name: string): void {
    if (this.newRelicConfig.isEnabled) {
      try {
        newrelic.setTransactionName(name);
      } catch (error) {
        this.logger.warn(`Failed to set transaction name: ${error.message}`);
      }
    }
  }

  recordDatabaseQuery(collection: string, operation: string, duration: number): void {
    this.recordMetric(`Database/${collection}/${operation}`, duration);
  }

  recordCsvProcessingMetrics(rowCount: number, processingTime: number, successCount: number, errorCount: number): void {
    this.recordMetric('CSV/TotalRows', rowCount);
    this.recordMetric('CSV/ProcessingTime', processingTime);
    this.recordMetric('CSV/SuccessCount', successCount);
    this.recordMetric('CSV/ErrorCount', errorCount);

    this.recordEvent('CSVProcessingCompleted', {
      rowCount,
      processingTime,
      successCount,
      errorCount,
      successRate: successCount / rowCount,
      timestamp: new Date().toISOString(),
    });
  }

  recordApiResponseTime(endpoint: string, method: string, duration: number, statusCode: number): void {
    this.recordMetric(`API/${method}/${endpoint}`, duration);

    this.recordEvent('APIRequest', {
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  async startWebTransaction<T>(name: string, operation: () => Promise<T>): Promise<T> {
    if (!this.newRelicConfig.isEnabled) {
      return operation();
    }

    return newrelic.startWebTransaction(name, async () => {
      try {
        newrelic.addCustomAttributes({
          webTransaction: true,
          transactionName: name
        });

        const result = await operation();
        return result;
      } catch (error) {
        this.recordError(error);
        throw error;
      }
    });
  }
}