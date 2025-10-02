import { Module, Global, DynamicModule } from '@nestjs/common';
import { NewRelicService } from './newrelic.service';
import { NewRelicConfig } from './newrelic.config';

@Global()
@Module({})
export class NewRelicModule {
  static forRoot(): DynamicModule {
    return {
      module: NewRelicModule,
      providers: [NewRelicConfig, NewRelicService],
      exports: [NewRelicService, NewRelicConfig],
    };
  }
}