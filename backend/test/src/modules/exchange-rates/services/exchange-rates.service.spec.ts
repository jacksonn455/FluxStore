import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ExchangeRatesService } from '../../../../../src/modules/exchange-rates/services/exchange-rates.service';
import { RedisService } from '../../../../../src/common/config/redis/redis.service';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;
  let httpService: HttpService;
  let redisService: RedisService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
    httpService = module.get<HttpService>(HttpService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getExchangeRates', () => {
    it('should return cached rates if available (object)', async () => {
      const mockCachedRates = {
        date: '2023-01-01',
        rates: { USD: 1, EUR: 0.9 },
      };
      jest.spyOn(mockRedisService, 'get').mockResolvedValue(mockCachedRates);

      const result = await service.getExchangeRates();

      expect(mockRedisService.get).toHaveBeenCalledWith('exchange_rates');
      expect(httpService.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedRates);
    });

    it('should return cached rates if available (stringified JSON)', async () => {
      const mockCachedRates = {
        date: '2023-01-01',
        rates: { USD: 1, EUR: 0.9 },
      };
      jest
        .spyOn(mockRedisService, 'get')
        .mockResolvedValue(JSON.stringify(mockCachedRates));

      const result = await service.getExchangeRates();

      expect(mockRedisService.get).toHaveBeenCalledWith('exchange_rates');
      expect(httpService.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockCachedRates);
    });

    it('should fetch from API, cache, and return rates if no cache', async () => {
      const mockApiRates = { rates: { USD: 1, EUR: 0.9, GBP: 0.8 } };
      jest.spyOn(mockRedisService, 'get').mockResolvedValue(null);
      jest
        .spyOn(mockHttpService, 'get')
        .mockReturnValue(
          of({
            data: mockApiRates,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
          }),
        );
      jest.spyOn(mockRedisService, 'set').mockResolvedValue('OK');

      const result = await service.getExchangeRates();

      expect(mockRedisService.get).toHaveBeenCalledWith('exchange_rates');
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.exchangerate-api.com/v4/latest/USD',
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'exchange_rates',
        expect.any(String),
        3600,
      );
      expect(result.rates).toEqual(mockApiRates.rates);
      expect(result.date).toBeDefined();
    });

    it('should throw an error if API call fails', async () => {
      jest.clearAllMocks();

      const mockError = new Error('API Error');
      jest.spyOn(mockRedisService, 'get').mockResolvedValue(null);
      jest
        .spyOn(mockHttpService, 'get')
        .mockReturnValue(throwError(() => mockError));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      mockRedisService.set.mockImplementation((...args) => {
        console.log('Redis set was called with:', args);
        return Promise.resolve('OK');
      });

      await expect(service.getExchangeRates()).rejects.toThrow(
        'Failed to fetch exchange rates',
      );

      expect(mockRedisService.set).not.toHaveBeenCalled();
    });
  });

  describe('getSelectedCurrencies', () => {
    it('should return selected currencies when all are present', () => {
      const rates = {
        EUR: 0.9,
        GBP: 0.8,
        JPY: 130,
        CAD: 1.3,
        AUD: 1.4,
        BRL: 5.0,
        USD: 1.0,
      };
      const expected = {
        EUR: 0.9,
        GBP: 0.8,
        JPY: 130,
        CAD: 1.3,
        AUD: 1.4,
        BRL: 5.0,
      };
      expect(service.getSelectedCurrencies(rates)).toEqual(expected);
    });

    it('should return only present selected currencies when some are absent', () => {
      const rates = { EUR: 0.9, JPY: 130, BRL: 5.0, NZD: 1.5 };
      const expected = { EUR: 0.9, JPY: 130, BRL: 5.0 };
      expect(service.getSelectedCurrencies(rates)).toEqual(expected);
    });

    it('should return an empty object if no selected currencies are present', () => {
      const rates = { NZD: 1.5, CHF: 0.9 };
      const expected = {};
      expect(service.getSelectedCurrencies(rates)).toEqual(expected);
    });

    it('should return an empty object if the rates object is empty', () => {
      const rates = {};
      const expected = {};
      expect(service.getSelectedCurrencies(rates)).toEqual(expected);
    });

    it('should ignore currencies not in the selected list', () => {
      const rates = { EUR: 0.9, ZAR: 18.0, USD: 1.0 };
      const expected = { EUR: 0.9 };
      expect(service.getSelectedCurrencies(rates)).toEqual(expected);
    });
  });
});
