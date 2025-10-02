import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../../common/config/redis/redis.service';

@Injectable()
export class ExchangeRatesService {
  private readonly API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
  ) {}

  async getExchangeRates(): Promise<{ date: string; rates: any }> {
    const cacheKey = 'exchange_rates';

    const cachedRates = await this.redisService.get(cacheKey);
    if (cachedRates) {
      if (typeof cachedRates === 'string') {
        return JSON.parse(cachedRates);
      }
      return cachedRates as { date: string; rates: any };
    }

    try {
      const response = await firstValueFrom(this.httpService.get(this.API_URL));

      const ratesData = {
        date: new Date().toISOString(),
        rates: response.data.rates,
      };

      await this.redisService.set(cacheKey, JSON.stringify(ratesData), 3600);
      return ratesData;
    } catch (error) {
      console.error('❌ Error fetching exchange rates:', error.message);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  getSelectedCurrencies(rates: any): any {
    const selectedCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'BRL'];
    const selectedRates = {};

    selectedCurrencies.forEach((currency) => {
      if (rates[currency]) {
        selectedRates[currency] = rates[currency];
      }
    });

    return selectedRates;
  }
}
