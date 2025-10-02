
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private isConnected = false;
  private connectionPromise: Promise<void>;
  private isConnecting = false;

  constructor() {
    this.connectionPromise = this.connect();
  }

  async onModuleInit() {
    await this.connectionPromise;
  }

  async onModuleDestroy() {
    await this.closeConnection();
  }

  private async connect(): Promise<void> {
    if (this.isConnecting) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      await this.setupCsvProcessing();
      
    } catch (error) {
      this.logger.error(`❌ Failed to connect to RabbitMQ: ${error.message}`);
      this.isConnected = false;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async setupCsvProcessing() {
    try {
      await this.channel.assertExchange('csv_processing', 'direct', { durable: true });
      await this.channel.assertQueue('csv_processing_queue', { durable: true });
      await this.channel.bindQueue('csv_processing_queue', 'csv_processing', 'process.csv');
    } catch (error) {
      this.logger.error(`❌ Failed to setup CSV processing: ${error.message}`);
      throw error;
    }
  }

  
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connectionPromise;
    }
    
    if (!this.isConnected) {
      throw new Error('RabbitMQ not connected after waiting');
    }
  }

  async sendToCsvQueue(filePath: string): Promise<boolean> {
    try {
      await this.ensureConnected();

      const message = {
        filePath,
        timestamp: new Date().toISOString(),
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));

      const sent = this.channel.publish(
        'csv_processing',
        'process.csv',
        messageBuffer,
        { persistent: true }
      );

      if (sent) {
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`❌ Error sending CSV message: ${error.message}`);
      return false;
    }
  }

  async consumeCsvQueue(processor: (message: any) => Promise<void>): Promise<void> {
    try {
      await this.ensureConnected();

      await this.channel.consume('csv_processing_queue', async (message) => {
        if (message === null) return;

        try {
          const content = JSON.parse(message.content.toString());
          await processor(content);
          this.channel.ack(message);
        } catch (error) {
          this.logger.error(`❌ Error processing CSV: ${error.message}`);
          this.channel.nack(message, false, false);
        }
      }, { noAck: false });
    } catch (error) {
      this.logger.error(`❌ Error consuming CSV queue: ${error.message}`);
      throw error;
    }
  }

  
  async waitForConnection(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return true;
    } catch {
      return false;
    }
  }

  private async closeConnection() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.logger.log('✅ RabbitMQ channel closed');
      }
      if (this.connection) {
        await this.connection.close();
        this.logger.log('✅ RabbitMQ connection closed');
      }
      this.isConnected = false;
    } catch (error) {
      this.logger.error(`❌ Error closing RabbitMQ connection: ${error.message}`);
    }
  }

  getStatus(): { isConnected: boolean } {
    return { isConnected: this.isConnected };
  }
}