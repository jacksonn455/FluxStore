import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.closeConnection();
  }

  private async connect(): Promise<void> {
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this._doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
    }
  }

  private async _doConnect(): Promise<void> {
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';

      this.logger.log(`🔄 Attempting to connect to RabbitMQ: ${rabbitmqUrl}`);

      this.connection = await amqp.connect(rabbitmqUrl, {
        heartbeat: 60,
        timeout: 10000,
      });

      this.connection.on('error', (error) => {
        this.logger.error(`❌ RabbitMQ connection error: ${error.message}`);
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.connection.on('close', () => {
        this.logger.warn('⚠️ RabbitMQ connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.channel = await this.connection.createChannel();

      this.channel.on('error', (error) => {
        this.logger.error(`❌ RabbitMQ channel error: ${error.message}`);
      });

      this.channel.on('close', () => {
        this.logger.warn('⚠️ RabbitMQ channel closed');
      });

      await this.channel.prefetch(10);

      await this.setupCsvProcessing();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log('✅ Successfully connected to RabbitMQ');
    } catch (error) {
      this.logger.error(`❌ Failed to connect to RabbitMQ: ${error.message}`);
      this.isConnected = false;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.logger.error('❌ Max reconnection attempts reached. Giving up.');
      }

      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.logger.log(
      `🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error(`❌ Reconnection attempt failed: ${error.message}`);
      });
    }, delay);
  }

  private async setupCsvProcessing(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    try {
      await this.channel.assertExchange('csv_processing', 'direct', {
        durable: true,
        autoDelete: false,
      });

      await this.channel.assertQueue('csv_processing_queue', {
        durable: true,
        autoDelete: false,
        arguments: {
          'x-max-retries': 3,
          'x-message-ttl': 3600000,
        },
      });

      await this.channel.bindQueue(
        'csv_processing_queue',
        'csv_processing',
        'process.csv',
      );
    } catch (error) {
      this.logger.error(`❌ Failed to setup CSV processing: ${error.message}`);
      throw error;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this.channel) {
      if (this.connectionPromise) {
        await this.connectionPromise;
      } else {
        await this.connect();
      }
    }

    if (!this.isConnected || !this.channel) {
      throw new Error('RabbitMQ not connected or channel not available');
    }
  }

  async sendToCsvQueue(filePath: string): Promise<boolean> {
    try {
      await this.ensureConnected();

      if (!this.channel) {
        this.logger.error('❌ Channel not available for sending message');
        return false;
      }

      const message = {
        filePath,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));

      const sent = this.channel.publish(
        'csv_processing',
        'process.csv',
        messageBuffer,
        {
          persistent: true,
          mandatory: true,
          deliveryMode: 2,
        },
      );

      if (sent) {
        return true;
      } else {
        this.logger.error(
          '❌ Failed to send CSV processing message - channel returned false',
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ Error sending CSV message: ${error.message}`);
      return false;
    }
  }

  async consumeCsvQueue(
    processor: (message: any) => Promise<void>,
  ): Promise<void> {
    try {
      await this.ensureConnected();

      if (!this.channel) {
        throw new Error('Channel not available for consuming');
      }

      this.logger.log('🔄 Setting up CSV queue consumer...');

      await this.channel.consume(
        'csv_processing_queue',
        async (message) => {
          if (message === null) {
            this.logger.warn('⚠️ Received null message');
            return;
          }

          try {
            const content = JSON.parse(message.content.toString());
            this.logger.log(
              `📥 Processing CSV message: ${JSON.stringify(content)}`,
            );

            await processor(content);

            this.channel!.ack(message);
            this.logger.log('✅ CSV message processed successfully');
          } catch (error) {
            this.logger.error(
              `❌ Error processing CSV message: ${error.message}`,
            );

            const retryCount =
              (message.properties.headers?.['x-retry-count'] || 0) + 1;

            if (retryCount <= 3) {
              this.logger.log(`🔄 Retrying message (attempt ${retryCount}/3)`);
              this.channel!.nack(message, false, true);
            } else {
              this.logger.error('❌ Max retries exceeded, discarding message');
              this.channel!.nack(message, false, false);
            }
          }
        },
        {
          noAck: false,
          consumerTag: 'csv-processor',
        },
      );

      this.logger.log('✅ CSV queue consumer started successfully');
    } catch (error) {
      this.logger.error(
        `❌ Error setting up CSV queue consumer: ${error.message}`,
      );
      throw error;
    }
  }

  async waitForConnection(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await this.ensureConnected();
        return true;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.warn(`⚠️ Connection timeout after ${timeoutMs}ms`);
    return false;
  }

  private async closeConnection(): Promise<void> {
    try {
      this.isConnected = false;

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
        this.logger.log('✅ RabbitMQ channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
        this.logger.log('✅ RabbitMQ connection closed');
      }
    } catch (error) {
      this.logger.error(
        `❌ Error closing RabbitMQ connection: ${error.message}`,
      );
    }
  }

  getStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    hasChannel: boolean;
    hasConnection: boolean;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasChannel: !!this.channel,
      hasConnection: !!this.connection,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureConnected();

      const testMessage = {
        test: true,
        timestamp: new Date().toISOString(),
      };

      if (!this.channel) return false;

      const sent = this.channel.publish(
        'csv_processing',
        'process.csv',
        Buffer.from(JSON.stringify(testMessage)),
        { persistent: true },
      );

      this.logger.log(`🧪 Test message sent: ${sent}`);
      return sent;
    } catch (error) {
      this.logger.error(`❌ Connection test failed: ${error.message}`);
      return false;
    }
  }
}
