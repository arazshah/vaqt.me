import { Body, Controller, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { SystemRole } from '@vaqt/shared';
import type {
  CreateCategoryInput,
  CreateSkillInput,
  UpdateCategoryInput,
  UpdateSkillInput,
} from '@vaqt/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from '../categories/categories.service';
import { SkillsService } from '../skills/skills.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Controller('admin')
@Roles(SystemRole.ADMIN)
export class AdminController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly skills: SkillsService,
  ) {}

  @Post('categories')
  @UsePipes(new ZodValidationPipe(CreateCategoryDto))
  createCategory(@Body() body: CreateCategoryInput) {
    return this.categories.create(body);
  }

  @Patch('categories/:id')
  @UsePipes(new ZodValidationPipe(UpdateCategoryDto))
  updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryInput) {
    return this.categories.update(id, body);
  }

  @Post('skills')
  @UsePipes(new ZodValidationPipe(CreateSkillDto))
  createSkill(@Body() body: CreateSkillInput) {
    return this.skills.create(body);
  }

  @Patch('skills/:id')
  @UsePipes(new ZodValidationPipe(UpdateSkillDto))
  updateSkill(@Param('id') id: string, @Body() body: UpdateSkillInput) {
    return this.skills.update(id, body);
  }
}
