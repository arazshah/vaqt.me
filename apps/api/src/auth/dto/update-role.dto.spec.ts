import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRoleDto } from './update-role.dto';

describe('UpdateRoleDto', () => {
  it.each(['SEEKER', 'PROVIDER', 'BOTH'])(
    'accepts roleIntent=%s',
    async (roleIntent) => {
      const dto = plainToInstance(UpdateRoleDto, { roleIntent });
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('rejects an unknown roleIntent value', async () => {
    const dto = plainToInstance(UpdateRoleDto, { roleIntent: 'ADMIN' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing roleIntent', async () => {
    const dto = plainToInstance(UpdateRoleDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
