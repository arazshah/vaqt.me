import { prisma } from '@vaqt/db';

export interface SettingRow {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface SettingWrite extends SettingRow {
  updatedById: string | null;
}

/** Where settings live. Postgres in the app; in memory for tests that don't test storage. */
export interface SettingsStore {
  all(): Promise<SettingRow[]>;
  /** Applies upserts and deletions atomically. */
  apply(writes: SettingWrite[], deleteKeys: string[]): Promise<void>;
}

export const SETTINGS_STORE = Symbol('SETTINGS_STORE');

export class PrismaSettingsStore implements SettingsStore {
  async all(): Promise<SettingRow[]> {
    const rows = await prisma.appSetting.findMany();
    return rows.map((r) => ({
      key: r.key,
      value: r.value,
      isSecret: r.isSecret,
    }));
  }

  async apply(writes: SettingWrite[], deleteKeys: string[]): Promise<void> {
    await prisma.$transaction([
      ...writes.map((w) =>
        prisma.appSetting.upsert({
          where: { key: w.key },
          create: {
            key: w.key,
            value: w.value,
            isSecret: w.isSecret,
            updatedById: w.updatedById,
          },
          update: {
            value: w.value,
            isSecret: w.isSecret,
            updatedById: w.updatedById,
          },
        }),
      ),
      prisma.appSetting.deleteMany({ where: { key: { in: deleteKeys } } }),
    ]);
  }
}

export class MemorySettingsStore implements SettingsStore {
  private readonly rows = new Map<string, SettingRow>();

  all(): Promise<SettingRow[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  apply(writes: SettingWrite[], deleteKeys: string[]): Promise<void> {
    for (const w of writes) {
      this.rows.set(w.key, {
        key: w.key,
        value: w.value,
        isSecret: w.isSecret,
      });
    }
    for (const key of deleteKeys) this.rows.delete(key);
    return Promise.resolve();
  }
}
