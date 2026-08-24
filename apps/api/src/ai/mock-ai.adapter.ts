import { Injectable } from '@nestjs/common';
import { normalizeFa, RequestMode, tomanToRial } from '@vaqt/shared';
import type { AiChatMessage } from '@vaqt/shared';
import type { AiCategoryOption, AiExtractionResult, AiPort } from './ai.port';

const KNOWN_CITIES = [
  'تهران',
  'مشهد',
  'اصفهان',
  'شیراز',
  'تبریز',
  'کرج',
  'اهواز',
  'قم',
];

const DURATION_RE = /(\d+)\s*(دقیقه|ساعت)/;
const BUDGET_RANGE_RE =
  /(?:بین|از)\s*(\d+)\s*(?:تا|و)\s*(\d+)\s*(میلیون\s*)?تومان/;
const BUDGET_SINGLE_RE = /(?:حدود|تقریبا|تقریباً)\s*(\d+)\s*(میلیون\s*)?تومان/;

function toRialWithScale(value: number, isMillion: boolean): number {
  const toman = isMillion ? value * 1_000_000 : value;
  return tomanToRial(toman);
}

/**
 * Deterministic, network-free stand-in for a real LLM — good enough to
 * develop and test the wizard flow locally without an API key (see
 * PROJECT_SPEC.md: "پیش‌فرض لوکال: mock"). Extracts a handful of fields
 * with simple keyword/regex heuristics; nowhere near as capable as the
 * real Anthropic adapter, but exercises the same AiService retry/fallback
 * and category-validation logic.
 */
@Injectable()
export class MockAiAdapter implements AiPort {
  extract(
    messages: AiChatMessage[],
    categories: AiCategoryOption[],
  ): Promise<AiExtractionResult> {
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
    const combined = userMessages.join(' ').trim();
    const normalized = normalizeFa(combined);

    const title =
      combined.length >= 5 ? combined.slice(0, 120).split('\n')[0] : null;
    const description = combined.length >= 20 ? combined.slice(0, 3000) : null;

    const category = categories.find((c) =>
      normalized.includes(normalizeFa(c.name)),
    );

    const hasOnline = normalized.includes(normalizeFa('آنلاین'));
    const hasInPerson = normalized.includes(normalizeFa('حضوری'));
    const mode =
      hasOnline && hasInPerson
        ? RequestMode.HYBRID
        : hasOnline
          ? RequestMode.ONLINE
          : hasInPerson
            ? RequestMode.IN_PERSON
            : null;

    const city =
      KNOWN_CITIES.find((c) => normalized.includes(normalizeFa(c))) ?? null;

    const durationMatch = DURATION_RE.exec(normalized);
    const durationMinutes = durationMatch
      ? Number(durationMatch[1]) * (durationMatch[2] === 'ساعت' ? 60 : 1)
      : null;

    let budgetMinRial: number | null = null;
    let budgetMaxRial: number | null = null;
    const rangeMatch = BUDGET_RANGE_RE.exec(normalized);
    if (rangeMatch) {
      const isMillion = Boolean(rangeMatch[3]);
      budgetMinRial = toRialWithScale(Number(rangeMatch[1]), isMillion);
      budgetMaxRial = toRialWithScale(Number(rangeMatch[2]), isMillion);
    } else {
      const singleMatch = BUDGET_SINGLE_RE.exec(normalized);
      if (singleMatch) {
        const isMillion = Boolean(singleMatch[2]);
        const value = toRialWithScale(Number(singleMatch[1]), isMillion);
        budgetMinRial = value;
        budgetMaxRial = value;
      }
    }

    const fields: Record<string, unknown> = {
      title,
      description,
      categoryId: category?.id ?? null,
      mode,
      city,
      durationMinutes,
      budgetMinRial,
      budgetMaxRial,
    };
    const required = [
      'title',
      'description',
      'categoryId',
      'mode',
      'durationMinutes',
      'budgetMinRial',
      'budgetMaxRial',
    ];
    const missingFields = required.filter((key) => fields[key] === null);

    const questionsByField: Record<string, string> = {
      title: 'می‌توانید کمی بیشتر توضیح دهید چه کاری نیاز دارید؟',
      description: 'لطفاً کمی کامل‌تر توضیح دهید — جزئیات بیشتر کمک می‌کند.',
      categoryId: 'این کار در چه دسته‌بندی‌ای قرار می‌گیرد؟',
      mode: 'این کار به‌صورت آنلاین انجام شود یا حضوری؟',
      durationMinutes: 'این کار تقریباً چقدر زمان می‌برد؟',
      budgetMinRial: 'بودجه‌ی تقریبی شما برای این کار چقدر است؟',
      budgetMaxRial: 'بودجه‌ی تقریبی شما برای این کار چقدر است؟',
    };
    const clarifyingQuestion =
      missingFields.length > 0
        ? (questionsByField[missingFields[0]] ?? null)
        : null;

    return Promise.resolve({
      raw: {
        ...fields,
        missingFields,
        clarifyingQuestion,
      },
      tokensUsed: 0,
    });
  }
}
