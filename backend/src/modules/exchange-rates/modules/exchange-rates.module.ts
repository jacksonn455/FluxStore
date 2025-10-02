
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExchangeRatesService } from '../services/exchange-rates.service';
import { RedisService } from '../../../common/config/redis/redis.service';

@Module({
  imports: [
    HttpModule,
  ],
  providers: [
    ExchangeRatesService,
    RedisService,
  ],
  exports: [
    ExchangeRatesService,
  ],
})
export class ExchangeRatesModule { }