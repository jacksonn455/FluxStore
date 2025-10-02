import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class IpBasedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const remoteAddress = req.connection?.remoteAddress;
    
    const ip = forwarded?.split(',')[0] || realIp || remoteAddress || 'unknown';
    
    return `csv-upload:${ip}`;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const ip = await this.getTracker(request);
    
    throw new ThrottlerException(
      `Rate limit exceeded for CSV upload from IP: ${ip.replace('csv-upload:', '')}. Please wait before trying again.`
    );
  }
}