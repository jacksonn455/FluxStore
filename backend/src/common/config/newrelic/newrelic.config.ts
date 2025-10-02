import { Injectable } from '@nestjs/common';

@Injectable()
export class NewRelicConfig {
  get config() {
    const licenseKey = process.env.NEW_RELIC_LICENSE_KEY;
    
    if (!licenseKey) {
      console.warn('⚠️ NEW_RELIC_LICENSE_KEY not found in environment variables');
    }

    return {
      app_name: process.env.NEW_RELIC_APP_NAME || 'fluxstore-api',
      license_key: licenseKey,
      distributed_tracing: {
        enabled: true,
      },
      logging: {
        level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
        filepath: 'stdout',
      },
      allow_all_headers: true,
      attributes: {
        exclude: [
          'request.headers.cookie',
          'request.headers.authorization',
          'request.headers.proxyAuthorization',
          'request.headers.setCookie*',
          'request.headers.x*',
          'response.headers.cookie',
          'response.headers.authorization',
          'response.headers.proxyAuthorization',
          'response.headers.setCookie*',
          'response.headers.x*',
        ],
      },
      application_logging: {
        forwarding: {
          enabled: true,
        },
      },
      transaction_events: {
        enabled: true,
      },
      error_collector: {
        enabled: true,
      },
    };
  }

  get isEnabled(): boolean {
    const enabled = !!process.env.NEW_RELIC_LICENSE_KEY;
    return enabled;
  }
}