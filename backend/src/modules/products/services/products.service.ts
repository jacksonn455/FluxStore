import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../entities/product.entity';
import { ProductDTO } from '../dtos/product.dto';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExchangeRatesService } from '../../exchange-rates/services/exchange-rates.service';
import { RabbitMQService } from '../../../common/config/rabbitmq/rabbitmq.service';
import { RedisService } from '../../../common/config/redis/redis.service';
import { NewRelicService } from '../../../common/config/newrelic/newrelic.service';
import { MeasureExecutionTime } from '../../../common/config/newrelic/newrelic.decorators';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    private exchangeRatesService: ExchangeRatesService,
    private rabbitMQService: RabbitMQService,
    private redisService: RedisService,
    private readonly newRelicService: NewRelicService,
  ) {
    this.initializeQueueConsumerWithMonitoring();
  }

  private async initializeQueueConsumerWithMonitoring() {
    return this.newRelicService.startBackgroundTransaction(
      'InitializeQueueConsumer',
      'BackgroundJob',
      async () => {
        try {
          this.newRelicService.addCustomAttributes({
            service: 'ProductsService',
            operation: 'initializeQueueConsumer',
          });

          const isConnected = await this.rabbitMQService.waitForConnection();

          if (isConnected) {
            await this.setupQueueConsumer();
            this.newRelicService.incrementCounter(
              'rabbitmq.consumer.initialized',
            );
          } else {
            this.logger.warn(
              '⚠️ RabbitMQ not available, queue consumer not started',
            );
            this.newRelicService.incrementCounter('rabbitmq.connection.failed');
            setTimeout(
              () => this.initializeQueueConsumerWithMonitoring(),
              10000,
            );
          }
        } catch (error) {
          this.newRelicService.recordError(error, {
            context: 'initializeQueueConsumer',
            service: 'ProductsService',
          });
          this.logger.error(
            `❌ Failed to initialize queue consumer: ${error.message}`,
          );
          setTimeout(() => this.initializeQueueConsumerWithMonitoring(), 10000);
        }
      },
    );
  }

  private async setupQueueConsumer() {
    this.newRelicService.addCustomAttributes({
      operation: 'setupQueueConsumer',
    });

    await this.rabbitMQService.consumeCsvQueue(async (message) => {
      return this.newRelicService.startBackgroundTransaction(
        'ProcessCSVFromQueue',
        'MessageQueue',
        async () => {
          try {
            const { filePath } = message;

            if (!filePath) {
              this.newRelicService.incrementCounter(
                'csv.queue.message.invalid',
              );
              this.logger.error('❌ No filePath provided in message');
              return;
            }

            this.newRelicService.addCustomAttributes({
              filePath,
              messageId: message.messageId || 'unknown',
            });

            const maxRetries = 5;
            let retryCount = 0;
            while (retryCount < maxRetries) {
              if (fs.existsSync(filePath)) {
                break;
              }
              this.logger.warn(
                `⚠️ File not found: ${filePath}, retrying (${retryCount + 1}/${maxRetries})`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (retryCount + 1)),
              );
              retryCount++;
            }

            if (!fs.existsSync(filePath)) {
              this.newRelicService.incrementCounter('csv.queue.file.missing');
              this.logger.error(`❌ File not found after retries: ${filePath}`);
              throw new Error('Temporary file missing');
            }

            const result = await this.processCSVFileWithMetrics(filePath);

            this.newRelicService.recordEvent('CSVQueueProcessingCompleted', {
              filePath,
              successCount: result.successCount,
              errorCount: result.errors.length,
              processingSource: 'queue',
            });

            if (this.redisService) {
              await this.redisService.set(
                `csv_result_${Date.now()}`,
                {
                  success: result.successCount,
                  errors: result.errors.length,
                  timestamp: new Date().toISOString(),
                  source: 'queue',
                },
                3600,
              );
            }

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              this.logger.log(`✅ Temporary file deleted: ${filePath}`);
            }
          } catch (error) {
            this.newRelicService.recordError(error, {
              context: 'queueCSVProcessing',
              filePath: message.filePath,
            });
            this.newRelicService.incrementCounter(
              'csv.queue.processing.failed',
            );
            this.logger.error(
              `❌ Error processing CSV from queue: ${error.message}`,
            );
            throw error;
          }
        },
      );
    });
  }

  @MeasureExecutionTime('ProductsService.processCSVFromFile')
  async processCSVFromFile(): Promise<{ message: string }> {
    const csvFilePath = path.join(
      process.cwd(),
      'test/load/data',
      'products-200000.csv',
    );

    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found at: ${csvFilePath}`);
    }

    const isConnected = await this.rabbitMQService.waitForConnection();

    if (!isConnected) {
      const result = await this.processCSVFileSync(csvFilePath);
      return {
        message: `CSV processed synchronously. Success: ${result.success}, Errors: ${result.errors}`,
      };
    }

    const sent = await this.rabbitMQService.sendToCsvQueue(csvFilePath);

    if (sent) {
      return {
        message: 'CSV sent for background processing via RabbitMQ.',
      };
    } else {
      const result = await this.processCSVFileSync(csvFilePath);
      return {
        message: `CSV processed synchronously. Success: ${result.success}, Errors: ${result.errors}`,
      };
    }
  }

  private async processCSVFileSync(
    csvFilePath: string,
  ): Promise<{ success: number; errors: number; message: string }> {
    this.logger.log('🔄 Processing CSV synchronously (RabbitMQ not available)');
    this.newRelicService.incrementCounter('csv.processing.sync');

    try {
      const result = await this.processCSVFileWithMetrics(csvFilePath);

      this.newRelicService.recordEvent('CSVProcessingCompleted', {
        processingType: 'synchronous',
        successCount: result.successCount,
        errorCount: result.errors.length,
      });

      return {
        success: result.successCount,
        errors: result.errors.length,
        message: `CSV processed synchronously. Success: ${result.successCount}, Errors: ${result.errors.length}`,
      };
    } catch (error) {
      this.newRelicService.recordError(error, { context: 'syncCSVProcessing' });
      this.newRelicService.incrementCounter('csv.processing.sync.failed');
      this.logger.error(
        `❌ Synchronous CSV processing failed: ${error.message}`,
      );
      return {
        success: 0,
        errors: 1,
        message: 'CSV processing failed',
      };
    }
  }

  private async processCSVFileWithMetrics(
    csvFilePath: string,
  ): Promise<{ successCount: number; errors: any[] }> {
    const startTime = Date.now();

    return this.newRelicService.startBackgroundTransaction(
      'ProcessCSVFile',
      'CSVProcessing',
      async () => {
        return new Promise(async (resolve, reject) => {
          this.newRelicService.addCustomAttributes({
            operation: 'processCSVFileWithMetrics',
            filePath: csvFilePath,
          });

          const results: ProductDTO[] = [];
          const errors: any[] = [];
          let successCount = 0;

          let exchangeRates;
          try {
            const ratesData =
              await this.exchangeRatesService.getExchangeRates();
            const selectedRates =
              this.exchangeRatesService.getSelectedCurrencies(ratesData.rates);

            exchangeRates = {
              date: ratesData.date,
              rates: selectedRates,
            };

            this.newRelicService.recordMetric(
              'ExchangeRates.FetchTime',
              Date.now() - startTime,
            );
            this.newRelicService.incrementCounter(
              'exchangeRates.fetch.success',
            );
          } catch (error) {
            this.newRelicService.recordError(error, {
              context: 'exchangeRatesFetch',
            });
            this.newRelicService.incrementCounter('exchangeRates.fetch.failed');
            this.logger.error('❌ Failed to fetch exchange rates:', error);
            reject(error);
            return;
          }

          let lineCount = 0;
          let processedCount = 0;

          const stream = fs
            .createReadStream(csvFilePath)
            .pipe(
              csv({
                separator: ';',
                headers: ['name', 'price', 'expiration'],
                mapHeaders: ({ header, index }) => header.trim(),
                mapValues: ({ value, header, index }) => value.trim(),
                skipLines: 1,
              }),
            )
            .on('data', (data) => {
              lineCount++;
              processedCount++;

              try {
                if (
                  data.name === 'name' &&
                  data.price === 'price' &&
                  data.expiration === 'expiration'
                ) {
                  return;
                }

                const hasEmptyFields =
                  !data.name || !data.price || !data.expiration;
                if (hasEmptyFields) {
                  this.newRelicService.incrementCounter(
                    'csv.validation.empty_fields',
                  );
                  errors.push({
                    row: data,
                    error: `Missing required fields`,
                    line: lineCount,
                  });
                  return;
                }

                const price = parseFloat(
                  data.price.replace('$', '').replace(',', '').trim(),
                );
                if (isNaN(price)) {
                  this.newRelicService.incrementCounter(
                    'csv.validation.invalid_price',
                  );
                  errors.push({
                    row: data,
                    error: `Invalid price format: ${data.price}`,
                    line: lineCount,
                  });
                  return;
                }

                const dateParts = data.expiration.split('/');
                if (dateParts.length === 3) {
                  const [month, day, year] = dateParts.map((part) =>
                    parseInt(part),
                  );

                  if (isNaN(month) || isNaN(day) || isNaN(year)) {
                    this.newRelicService.incrementCounter(
                      'csv.validation.invalid_date_numbers',
                    );
                    errors.push({
                      row: data,
                      error: `Invalid date numbers: ${data.expiration}`,
                      line: lineCount,
                    });
                    return;
                  }

                  const expiration = new Date(year, month - 1, day);
                  if (
                    expiration.toString() === 'Invalid Date' ||
                    expiration.getFullYear() !== year
                  ) {
                    this.newRelicService.incrementCounter(
                      'csv.validation.invalid_date',
                    );
                    errors.push({
                      row: data,
                      error: `Invalid date: ${data.expiration}`,
                      line: lineCount,
                    });
                    return;
                  }

                  const product: ProductDTO = {
                    name: data.name.trim(),
                    price: price,
                    expiration: expiration,
                    exchangeRates: exchangeRates,
                  };
                  results.push(product);
                  successCount++;
                  this.newRelicService.incrementCounter(
                    'csv.row.processed.success',
                  );
                } else {
                  this.newRelicService.incrementCounter(
                    'csv.validation.invalid_date_format',
                  );
                  errors.push({
                    row: data,
                    error: `Invalid date format. Expected MM/DD/YYYY: ${data.expiration}`,
                    line: lineCount,
                  });
                }
              } catch (error) {
                this.newRelicService.incrementCounter(
                  'csv.row.processed.error',
                );
                errors.push({
                  row: data,
                  error: error.message,
                  line: lineCount,
                });
              }
            })
            .on('end', async () => {
              try {
                const processingTime = Date.now() - startTime;

                this.newRelicService.recordCsvProcessingMetrics(
                  lineCount,
                  processingTime,
                  successCount,
                  errors.length,
                );

                if (results.length > 0) {
                  await this.processProductsInBatches(results);
                }

                this.newRelicService.recordEvent('CSVFileProcessingCompleted', {
                  totalRows: lineCount,
                  successCount,
                  errorCount: errors.length,
                  processingTime,
                  filePath: csvFilePath,
                });

                resolve({ successCount, errors });
              } catch (error) {
                this.newRelicService.recordError(error, {
                  context: 'csvSaveToDatabase',
                });
                this.logger.error(
                  `❌ Error saving products to database: ${error.message}`,
                );
                reject(error);
              }
            })
            .on('error', (error) => {
              this.newRelicService.recordError(error, {
                context: 'csvStreamError',
              });
              this.newRelicService.incrementCounter('csv.stream.error');
              this.logger.error(`❌ Error reading CSV file: ${error.message}`);
              reject(error);
            });

          setTimeout(() => {
            if (!stream.destroyed) {
              stream.destroy();
              this.newRelicService.incrementCounter('csv.processing.timeout');
              reject(new Error('CSV processing timeout'));
            }
          }, 300000);
        });
      },
    );
  }

  @MeasureExecutionTime('ProductsService.processProductsInBatches')
  private async processProductsInBatches(
    products: ProductDTO[],
  ): Promise<void> {
    const batchSize = 1000;
    const startTime = Date.now();

    try {
      await this.productModel.deleteMany({});
      this.newRelicService.incrementCounter('database.products.cleared');

      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        try {
          const batchStartTime = Date.now();
          await this.productModel.insertMany(batch, { ordered: false });
          const batchTime = Date.now() - batchStartTime;

          this.newRelicService.recordMetric(`Batch.ProcessingTime`, batchTime);
          this.newRelicService.recordMetric(`Batch.Size`, batch.length);

          if (this.redisService) {
            const productIds = batch.map(
              (_, index) => `product:${i + index + 1}`,
            );
            await this.redisService.set(
              `batch_${batchNumber}`,
              JSON.stringify(productIds),
              3600,
            );
          }

          this.newRelicService.incrementCounter('database.batch.inserted');
        } catch (batchError) {
          this.newRelicService.recordError(batchError, {
            context: 'batchInsert',
            batchNumber,
            batchSize: batch.length,
          });
          this.newRelicService.incrementCounter('database.batch.failed');
          this.logger.error(
            `❌ Error in batch ${batchNumber}:`,
            batchError.message,
          );
        }
      }

      const totalTime = Date.now() - startTime;
      this.newRelicService.recordMetric(
        'Database.BatchProcessing.TotalTime',
        totalTime,
      );
      this.newRelicService.recordEvent('BatchProcessingCompleted', {
        totalProducts: products.length,
        batchSize,
        totalBatches: Math.ceil(products.length / batchSize),
        processingTime: totalTime,
      });
    } catch (error) {
      this.newRelicService.recordError(error, {
        context: 'processProductsInBatches',
      });
      throw error;
    }
  }

  @MeasureExecutionTime('ProductsService.findAll')
  async findAll(
    filters?: {
      name?: string;
      minPrice?: number;
      maxPrice?: number;
      expiration?: Date;
    },
    sort?: { field: string; order: 'asc' | 'desc' },
    page: number = 1,
    limit: number = 10,
  ): Promise<{ products: Product[]; total: number }> {
    return this.newRelicService.startBackgroundTransaction(
      'FindAllProducts',
      'DatabaseQuery',
      async () => {
        try {
          this.newRelicService.addCustomAttributes({
            operation: 'findAll',
            filters: JSON.stringify(filters),
            sort: JSON.stringify(sort),
            page,
            limit,
          });

          const cacheKey = `products:${JSON.stringify(filters)}:${JSON.stringify(sort)}:${page}:${limit}`;

          if (this.redisService) {
            const cached = await this.redisService.get(cacheKey);
            if (cached) {
              this.newRelicService.incrementCounter('cache.products.hit');
              if (typeof cached === 'string') {
                return JSON.parse(cached);
              } else if (typeof cached === 'object' && cached !== null) {
                const cachedResult = cached as any;
                if (cachedResult.products && cachedResult.total !== undefined) {
                  return cachedResult;
                }
              }
            }
            this.newRelicService.incrementCounter('cache.products.miss');
          }

          let query = this.productModel.find();

          if (filters) {
            const filterQuery: any = {};
            if (filters.name)
              filterQuery.name = { $regex: filters.name, $options: 'i' };
            if (
              filters.minPrice !== undefined ||
              filters.maxPrice !== undefined
            ) {
              filterQuery.price = {};
              if (filters.minPrice !== undefined)
                filterQuery.price.$gte = filters.minPrice;
              if (filters.maxPrice !== undefined)
                filterQuery.price.$lte = filters.maxPrice;
            }
            if (filters.expiration)
              filterQuery.expiration = { $gte: filters.expiration };
            query = query.where(filterQuery);
          }

          const total = await this.productModel.countDocuments(
            query.getFilter(),
          );
          this.newRelicService.recordMetric(
            'Database.Products.TotalCount',
            total,
          );

          if (sort) {
            const sortOrder = sort.order === 'desc' ? -1 : 1;
            query = query.sort({ [sort.field]: sortOrder });
          }

          const safePage = Math.max(1, page);
          const safeLimit = Math.max(1, Math.min(limit, 1000));
          query = query.skip((safePage - 1) * safeLimit).limit(safeLimit);

          const products = await query.exec();
          this.newRelicService.recordMetric(
            'Database.Products.ReturnedCount',
            products.length,
          );

          const result = { products, total };

          if (this.redisService) {
            await this.redisService.set(cacheKey, JSON.stringify(result), 15);
          }

          this.newRelicService.incrementCounter('database.products.queried');

          return result;
        } catch (error) {
          this.newRelicService.recordError(error, {
            context: 'findAllProducts',
          });
          this.newRelicService.incrementCounter(
            'database.products.query.failed',
          );
          throw error;
        }
      },
    );
  }

  @MeasureExecutionTime('ProductsService.createMany')
  async createMany(products: ProductDTO[]): Promise<Product[]> {
    this.newRelicService.addCustomAttributes({
      operation: 'createMany',
      productCount: products.length,
    });

    try {
      const result = await this.productModel.insertMany(products);
      this.newRelicService.incrementCounter(
        'database.products.created',
        products.length,
      );
      return result;
    } catch (error) {
      this.newRelicService.recordError(error, {
        context: 'createManyProducts',
      });
      throw error;
    }
  }

  @MeasureExecutionTime('ProductsService.count')
  async count(): Promise<number> {
    try {
      const count = await this.productModel.countDocuments().exec();
      this.newRelicService.recordMetric(
        'Database.Products.CurrentCount',
        count,
      );
      return count;
    } catch (error) {
      this.newRelicService.recordError(error, { context: 'countProducts' });
      throw error;
    }
  }

  @MeasureExecutionTime('ProductsService.processCSVFromUpload')
  async processCSVFromUpload(
    file: Express.Multer.File,
  ): Promise<{ processed: number; errors: number }> {
    if (!file || !file.buffer) {
      throw new Error('No file data provided');
    }

    const isConnected = await this.rabbitMQService.waitForConnection();

    if (!isConnected) {
      const result = await this.processCSVFileFromBuffer(file.buffer);
      return {
        processed: result.successCount,
        errors: result.errors.length,
      };
    }

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `uploaded_${Date.now()}_${file.originalname}`,
    );

    const dir = path.dirname(tempFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.writeFileSync(tempFilePath, file.buffer);
      this.logger.log(`✅ Temporary file written: ${tempFilePath}`);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const sent = await this.rabbitMQService.sendToCsvQueue(tempFilePath);

      if (sent) {
        this.logger.log(`✅ File sent to RabbitMQ queue: ${tempFilePath}`);
        return {
          processed: 0,
          errors: 0,
        };
      } else {
        const result = await this.processCSVFileFromBuffer(file.buffer);
        fs.unlinkSync(tempFilePath);
        this.logger.log(`✅ Temporary file deleted (sync): ${tempFilePath}`);
        return {
          processed: result.successCount,
          errors: result.errors.length,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Error writing temporary file: ${error.message}`);
      throw new Error(`Failed to process file: ${error.message}`);
    }
  }

  private async processCSVFileFromBuffer(
    buffer: Buffer,
  ): Promise<{ successCount: number; errors: any[] }> {
    this.logger.log('🔄 Processing CSV from uploaded buffer');
    this.newRelicService.incrementCounter('csv.processing.sync');

    return this.newRelicService.startBackgroundTransaction(
      'ProcessCSVFileFromBuffer',
      'CSVProcessing',
      async () => {
        return new Promise(async (resolve, reject) => {
          this.newRelicService.addCustomAttributes({
            operation: 'processCSVFileFromBuffer',
          });

          const results: ProductDTO[] = [];
          const errors: any[] = [];
          let successCount = 0;

          let exchangeRates;
          try {
            const ratesData =
              await this.exchangeRatesService.getExchangeRates();
            const selectedRates =
              this.exchangeRatesService.getSelectedCurrencies(ratesData.rates);

            exchangeRates = {
              date: ratesData.date,
              rates: selectedRates,
            };

            this.newRelicService.recordMetric(
              'ExchangeRates.FetchTime',
              Date.now() - Date.now(),
            );
            this.newRelicService.incrementCounter(
              'exchangeRates.fetch.success',
            );
          } catch (error) {
            this.newRelicService.recordError(error, {
              context: 'exchangeRatesFetch',
            });
            this.newRelicService.incrementCounter('exchangeRates.fetch.failed');
            this.logger.error('❌ Failed to fetch exchange rates:', error);
            reject(error);
            return;
          }

          let lineCount = 0;
          let processedCount = 0;

          const stream = require('stream').Readable.from(buffer);
          stream
            .pipe(
              csv({
                separator: ';',
                headers: ['name', 'price', 'expiration'],
                mapHeaders: ({ header, index }) => header.trim(),
                mapValues: ({ value, header, index }) => value.trim(),
                skipLines: 1,
              }),
            )
            .on('data', (data) => {
              lineCount++;
              processedCount++;

              try {
                if (
                  data.name === 'name' &&
                  data.price === 'price' &&
                  data.expiration === 'expiration'
                ) {
                  return;
                }

                const hasEmptyFields =
                  !data.name || !data.price || !data.expiration;
                if (hasEmptyFields) {
                  this.newRelicService.incrementCounter(
                    'csv.validation.empty_fields',
                  );
                  errors.push({
                    row: data,
                    error: `Missing required fields`,
                    line: lineCount,
                  });
                  return;
                }

                const price = parseFloat(
                  data.price.replace('$', '').replace(',', '').trim(),
                );
                if (isNaN(price)) {
                  this.newRelicService.incrementCounter(
                    'csv.validation.invalid_price',
                  );
                  errors.push({
                    row: data,
                    error: `Invalid price format: ${data.price}`,
                    line: lineCount,
                  });
                  return;
                }

                const dateParts = data.expiration.split('/');
                if (dateParts.length === 3) {
                  const [month, day, year] = dateParts.map((part) =>
                    parseInt(part),
                  );

                  if (isNaN(month) || isNaN(day) || isNaN(year)) {
                    this.newRelicService.incrementCounter(
                      'csv.validation.invalid_date_numbers',
                    );
                    errors.push({
                      row: data,
                      error: `Invalid date numbers: ${data.expiration}`,
                      line: lineCount,
                    });
                    return;
                  }

                  const expiration = new Date(year, month - 1, day);
                  if (
                    expiration.toString() === 'Invalid Date' ||
                    expiration.getFullYear() !== year
                  ) {
                    this.newRelicService.incrementCounter(
                      'csv.validation.invalid_date',
                    );
                    errors.push({
                      row: data,
                      error: `Invalid date: ${data.expiration}`,
                      line: lineCount,
                    });
                    return;
                  }

                  const product: ProductDTO = {
                    name: data.name.trim(),
                    price: price,
                    expiration: expiration,
                    exchangeRates: exchangeRates,
                  };
                  results.push(product);
                  successCount++;
                  this.newRelicService.incrementCounter(
                    'csv.row.processed.success',
                  );
                } else {
                  this.newRelicService.incrementCounter(
                    'csv.validation.invalid_date_format',
                  );
                  errors.push({
                    row: data,
                    error: `Invalid date format. Expected MM/DD/YYYY: ${data.expiration}`,
                    line: lineCount,
                  });
                }
              } catch (error) {
                this.newRelicService.incrementCounter(
                  'csv.row.processed.error',
                );
                errors.push({
                  row: data,
                  error: error.message,
                  line: lineCount,
                });
              }
            })
            .on('end', async () => {
              try {
                const processingTime = Date.now() - Date.now();

                this.newRelicService.recordCsvProcessingMetrics(
                  lineCount,
                  processingTime,
                  successCount,
                  errors.length,
                );

                if (results.length > 0) {
                  await this.processProductsInBatches(results);
                }

                this.newRelicService.recordEvent('CSVFileProcessingCompleted', {
                  totalRows: lineCount,
                  successCount,
                  errorCount: errors.length,
                  processingTime,
                  filePath: 'uploaded_buffer',
                });

                resolve({ successCount, errors });
              } catch (error) {
                this.newRelicService.recordError(error, {
                  context: 'csvSaveToDatabase',
                });
                this.logger.error(
                  `❌ Error saving products to database: ${error.message}`,
                );
                reject(error);
              }
            })
            .on('error', (error) => {
              this.newRelicService.recordError(error, {
                context: 'csvStreamError',
              });
              this.newRelicService.incrementCounter('csv.stream.error');
              this.logger.error(`❌ Error reading CSV file: ${error.message}`);
              reject(error);
            });

          setTimeout(() => {
            if (!stream.destroyed) {
              stream.destroy();
              this.newRelicService.incrementCounter('csv.processing.timeout');
              reject(new Error('CSV processing timeout'));
            }
          }, 300000);
        });
      },
    );
  }
}
