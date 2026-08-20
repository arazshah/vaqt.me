import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  async list(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { items, etag } = await this.skills.list();
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return { items };
  }
}
