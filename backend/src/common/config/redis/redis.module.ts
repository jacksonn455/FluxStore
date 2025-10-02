import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RedisService } from './redis.service';
import { redisConfig } from './redis.config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: () => ({
        ...redisConfig,
        readyLog: true,
        errorLog: true,
      }),
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisCacheModule {}