import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationQueueModule } from '../notifications/notification-queue.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [AuthModule, NotificationQueueModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
