import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ProductsModule } from './modules/products/modules/products.module';
import { ExchangeRatesModule } from './modules/exchange-rates/modules/exchange-rates.module';
import { RedisCacheModule } from './common/config/redis/redis.module';
import { RabbitMQModule } from './common/config/rabbitmq/rabbitmq.module';
import { NewRelicModule } from './common/config/newrelic/newrelic.module';
import { RateLimitingModule } from './modules/products/modules/rate-limiting.module';

@Module({
  imports: [
    NewRelicModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017/fluxstore',
      }),
    }),
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
    RateLimitingModule,
    RedisCacheModule,
    RabbitMQModule,
    ProductsModule,
    ExchangeRatesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }