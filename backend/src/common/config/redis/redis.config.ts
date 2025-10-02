export const redisConfig = {
  type: 'single' as const,
  options: {
    host: 'localhost',
    port: 6379,
    lazyConnect: false,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
};