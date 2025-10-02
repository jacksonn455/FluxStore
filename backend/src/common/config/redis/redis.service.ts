import { Injectable, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(
    @InjectRedis()
    private readonly redisClient: Redis,
  ) {}

  async set(
    key: string,
    value: string | number | object,
    expiration?: number,
  ): Promise<boolean> {
    try {
      const valueToStore =
        typeof value === 'object' ? JSON.stringify(value) : String(value);

      if (expiration) {
        await this.redisClient.setex(key, expiration, valueToStore);
      } else {
        await this.redisClient.set(key, valueToStore);
      }

      return true;
    } catch (error) {
      console.error(`Error setting key ${key}: ${error.message}`);
      return false;
    }
  }

  async get(key: string): Promise<string | number | object | null> {
    try {
      const value = await this.redisClient.get(key);

      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`Error getting key ${key}: ${error.message}`);
      return null;
    }
  }

  async getString(key: string): Promise<string | null> {
    const value = await this.get(key);
    return typeof value === 'string' ? value : null;
  }

  async getObject<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return typeof value === 'object' ? (value as T) : null;
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redisClient.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Error deleting key ${key}: ${error.message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking existence of key ${key}: ${error.message}`);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redisClient.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`Error setting expire for key ${key}: ${error.message}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redisClient.ttl(key);
    } catch (error) {
      console.error(`Error getting TTL for key ${key}: ${error.message}`);
      return -2;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.redisClient.incr(key);
    } catch (error) {
      console.error(`Error incrementing key ${key}: ${error.message}`);
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.redisClient.decr(key);
    } catch (error) {
      console.error(`Error decrementing key ${key}: ${error.message}`);
      throw error;
    }
  }

  getClient(): Redis {
    return this.redisClient;
  }
}
