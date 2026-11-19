import { Module } from '@nestjs/common';
import { CardAnalyticsService } from './card-analytics.service';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  controllers: [CardsController],
  providers: [CardsService, CardAnalyticsService],
})
export class CardsModule {}
