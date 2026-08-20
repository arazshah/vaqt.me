import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SystemRole } from '@vaqt/shared';
import { REQUIRED_ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { CategoriesService } from '../categories/categories.service';
import type { SkillsService } from '../skills/skills.service';
import { AdminController } from './admin.controller';

function makeCategories(): jest.Mocked<CategoriesService> {
  return {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<CategoriesService>;
}

function makeSkills(): jest.Mocked<SkillsService> {
  return {
    create: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<SkillsService>;
}

describe('AdminController', () => {
  it('is guarded with @Roles(ADMIN) at the class level, so every route requires the ADMIN system role', () => {
    const requiredRoles = Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      AdminController,
    ) as SystemRole[] | undefined;
    expect(requiredRoles).toEqual([SystemRole.ADMIN]);

    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) as
      (new (...args: never[]) => unknown)[] | undefined;
    expect(guards).toContain(RolesGuard);
  });

  it('createCategory delegates to CategoriesService.create', async () => {
    const categories = makeCategories();
    const controller = new AdminController(categories, makeSkills());
    const input = { name: 'دسته جدید', slug: 'new-cat' };

    await controller.createCategory(input);

    expect(categories.create).toHaveBeenCalledWith(input);
  });

  it('updateCategory delegates to CategoriesService.update with the id param and body', async () => {
    const categories = makeCategories();
    const controller = new AdminController(categories, makeSkills());

    await controller.updateCategory('cat-1', { isActive: false });

    expect(categories.update).toHaveBeenCalledWith('cat-1', {
      isActive: false,
    });
  });

  it('createSkill delegates to SkillsService.create', async () => {
    const skills = makeSkills();
    const controller = new AdminController(makeCategories(), skills);
    const input = { name: 'مهارت جدید', slug: 'new-skill' };

    await controller.createSkill(input);

    expect(skills.create).toHaveBeenCalledWith(input);
  });

  it('updateSkill delegates to SkillsService.update with the id param and body', async () => {
    const skills = makeSkills();
    const controller = new AdminController(makeCategories(), skills);

    await controller.updateSkill('skill-1', { isActive: false });

    expect(skills.update).toHaveBeenCalledWith('skill-1', { isActive: false });
  });
});
