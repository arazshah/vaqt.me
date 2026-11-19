import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { DbStorageAdapter } from './db-storage.adapter';
import { LocalDiskAdapter } from './local-disk.adapter';
import { S3Adapter } from './s3.adapter';
import { STORAGE_PORT, type StoragePort } from './storage.port';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_PORT,
      useFactory: (config: ConfigService): StoragePort => {
        const provider = config.get<string>('STORAGE_PROVIDER') ?? 'db';
        const uploadsBaseUrl =
          config.get<string>('LOCAL_STORAGE_PUBLIC_URL') ??
          'http://localhost:3001/uploads';

        if (provider === 'db') {
          return new DbStorageAdapter(uploadsBaseUrl);
        }

        if (provider === 'local') {
          const root =
            config.get<string>('LOCAL_STORAGE_DIR') ??
            join(process.cwd(), 'uploads');
          return new LocalDiskAdapter(root, uploadsBaseUrl);
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
