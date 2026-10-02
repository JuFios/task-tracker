import { Global, Module } from '@nestjs/common';
import { AppConfig } from './configuration';
import { validateEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => new AppConfig(validateEnv(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
