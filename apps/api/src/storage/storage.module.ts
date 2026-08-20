import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { LocalDiskAdapter } from './local-disk.adapter';
import { S3Adapter } from './s3.adapter';
import { STORAGE_PORT, type StoragePort } from './storage.port';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (config: ConfigService): StoragePort => {
        const provider = config.get<string>('STORAGE_PROVIDER') ?? 'local';

        if (provider === 'local') {
          const root =
            config.get<string>('LOCAL_STORAGE_DIR') ??
            join(process.cwd(), 'uploads');
          const publicBaseUrl =
            config.get<string>('LOCAL_STORAGE_PUBLIC_URL') ??
            'http://localhost:3001/uploads';
          return new LocalDiskAdapter(root, publicBaseUrl);
        }

        if (provider === 's3') {
          const required = (key: string): string => {
            const value = config.get<string>(key);
            if (!value) {
              throw new Error(`${key} must be set when STORAGE_PROVIDER=s3`);
            }
            return value;
          };
          return new S3Adapter({
            endpoint: required('S3_ENDPOINT'),
            region: config.get<string>('S3_REGION') ?? 'default',
            bucket: required('S3_BUCKET'),
            accessKeyId: required('S3_ACCESS_KEY_ID'),
            secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
            publicBaseUrl: required('S3_PUBLIC_URL_BASE'),
          });
        }

        throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
