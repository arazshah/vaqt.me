import { randomBytes } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  findSettingDefinition,
  SETTING_DEFINITIONS,
  validateSettingValue,
  type SettingDefinition,
  type SettingView,
  type UpdateSettingsInput,
} from '@vaqt/shared';
import { decryptSecret, encryptSecret } from './settings-crypto';
import { SETTINGS_STORE, type SettingsStore } from './settings.store';

const CACHE_TTL_MS = 10_000;

export class SettingsValidationError extends Error {
  constructor(
    readonly key: string,
    readonly reason: string,
  ) {
    super(`invalid setting ${key}: ${reason}`);
  }
}

interface Resolved {
  value: string | undefined;
  source: SettingView['source'];
}

/**
 * Runtime configuration. Resolution order for every key:
 *   admin panel (DB)  ->  environment variable (legacy/fallback)  ->  default.
 * Reads are cached for a few seconds and the cache is dropped on every write,
 * so a change made in the panel takes effect immediately on this instance.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache: { at: number; rows: Map<string, string> } | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
  ) {}

  private master(): string {
    const secret =
      this.config.get<string>('APP_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('APP_SECRET is not configured');
    return secret;
  }

  private async rows(): Promise<Map<string, string>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.rows;
    }
    const all = await this.store.all();
    const rows = new Map<string, string>();
    for (const row of all) {
      if (!row.isSecret) {
        rows.set(row.key, row.value);
        continue;
      }
      const plain = decryptSecret(row.value, this.master());
      if (plain === null) {
        this.logger.error(
          `cannot decrypt setting ${row.key}; was APP_SECRET changed? Treating it as unset.`,
        );
        continue;
      }
      rows.set(row.key, plain);
    }
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  private invalidate(): void {
    this.cache = null;
  }

  private fallback(def: SettingDefinition): Resolved {
    const fromEnv = def.env ? this.config.get<string>(def.env) : undefined;
    if (fromEnv) return { value: fromEnv, source: 'env' };
    const isProd = process.env.NODE_ENV === 'production';
    const dflt = isProd
      ? (def.productionDefault ?? def.defaultValue)
      : def.defaultValue;
    return dflt === undefined
      ? { value: undefined, source: 'none' }
      : { value: dflt, source: 'default' };
  }

  private async resolve(def: SettingDefinition): Promise<Resolved> {
    const stored = (await this.rows()).get(def.key);
    return stored !== undefined
      ? { value: stored, source: 'panel' }
      : this.fallback(def);
  }

  async get(key: string): Promise<string | undefined> {
    const def = findSettingDefinition(key);
    if (!def) throw new Error(`unknown setting: ${key}`);
    return (await this.resolve(def)).value;
  }

  async list(): Promise<SettingView[]> {
    const views: SettingView[] = [];
    for (const def of SETTING_DEFINITIONS) {
      const { value, source } = await this.resolve(def);
      views.push({
        key: def.key,
        group: def.group,
        kind: def.kind,
        ...(def.options && { options: def.options }),
        value: def.kind === 'secret' ? null : (value ?? null),
        isSet: value !== undefined && value !== '',
        source,
      });
    }
    return views;
  }

  /**
   * Validates everything first, then writes in one transaction, so a bad
   * value never leaves a half-applied change. Returns the keys that changed
   * (never their values: those may be secrets and go to the audit log).
   */
  async update(input: UpdateSettingsInput, actorId: string): Promise<string[]> {
    const writes: { def: SettingDefinition; value: string }[] = [];
    const toClear = [...input.clear];
    for (const [key, raw] of Object.entries(input.set)) {
      const def = findSettingDefinition(key);
      if (!def) throw new SettingsValidationError(key, 'unknown_key');
      const value = raw.trim();
      // An empty secret box means "leave as is".
      if (value === '' && def.kind === 'secret') continue;
      if (value === '') {
        toClear.push(key);
        continue;
      }
      const problem = validateSettingValue(def, value);
      if (problem) throw new SettingsValidationError(key, problem);
      writes.push({
        def,
        value: key === 'bale.botUsername' ? value.replace(/^@/, '') : value,
      });
    }
    const clears = [...new Set(toClear)].map((key) => {
      const def = findSettingDefinition(key);
      if (!def) throw new SettingsValidationError(key, 'unknown_key');
      return def.key;
    });

    await this.store.apply(
      writes.map(({ def, value }) => ({
        key: def.key,
        value:
          def.kind === 'secret' ? encryptSecret(value, this.master()) : value,
        isSecret: def.kind === 'secret',
        updatedById: actorId,
      })),
      clears,
    );
    this.invalidate();
    return [...writes.map((w) => w.def.key), ...clears];
  }

  /** The Bale webhook path secret, generated once on first need. */
  async ensureWebhookSecret(actorId: string | null): Promise<string> {
    const existing = await this.get('bale.webhookSecret');
    if (existing) return existing;
    const generated = randomBytes(24).toString('base64url');
    await this.store.apply(
      [
        {
          key: 'bale.webhookSecret',
          value: encryptSecret(generated, this.master()),
          isSecret: true,
          updatedById: actorId,
        },
      ],
      [],
    );
    this.invalidate();
    return generated;
  }
}
