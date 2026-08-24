'use client';

import { useEffect, useState } from 'react';
import type { AiChatMessage, AiExtractedDraft } from '@vaqt/shared';
import { formatToman } from '@vaqt/shared';

import { Button } from '@vaqt/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vaqt/ui/components/ui/card';
import { Textarea } from '@vaqt/ui/components/ui/textarea';
import { cn } from '@vaqt/ui/lib/utils';

import { apiFetch, ApiError } from '@/lib/api-client';
import { fa } from '@/messages/fa';
import { RequestForm, type RequestFormPrefill } from './request-form';

interface Category {
  id: string;
  name: string;
}

interface AiSessionResponse {
  id: string;
  messages: AiChatMessage[];
  draft: AiExtractedDraft | null;
  needsManualForm: boolean;
  fallbackMessage: string | null;
}

function draftToPrefill(draft: AiExtractedDraft): RequestFormPrefill {
  return {
    ...(draft.title ? { title: draft.title } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    ...(draft.mode ? { mode: draft.mode } : {}),
    ...(draft.city ? { city: draft.city } : {}),
    ...(draft.durationMinutes != null
      ? { durationMinutes: String(draft.durationMinutes) }
      : {}),
    ...(draft.budgetMinRial != null
      ? { budgetMinToman: String(Math.floor(draft.budgetMinRial / 10)) }
      : {}),
    ...(draft.budgetMaxRial != null
      ? { budgetMaxToman: String(Math.floor(draft.budgetMaxRial / 10)) }
      : {}),
  };
}

function DraftField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value ?? fa.aiWizardPage.draftEmptyField}</dd>
    </div>
  );
}

export function AiWizard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState<AiExtractedDraft | null>(null);
  const [needsManualForm, setNeedsManualForm] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Category[] }>('/categories')
      .then((res) => {
        setCategories(res.items);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  async function handleSend() {
    const message = input.trim();
    if (!message) return;
    setSending(true);
    setError(null);
    try {
      const res = sessionId
        ? await apiFetch<AiSessionResponse>('/ai/sessions/message', {
            method: 'POST',
            body: JSON.stringify({ sessionId, message }),
          })
        : await apiFetch<AiSessionResponse>('/ai/sessions', {
            method: 'POST',
            body: JSON.stringify({ message }),
          });
      setSessionId(res.id);
      setMessages(res.messages);
      setDraft(res.draft);
      setNeedsManualForm(res.needsManualForm);
      setInput('');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : fa.aiWizardPage.sendError,
      );
    } finally {
      setSending(false);
    }
  }

  if (reviewing || needsManualForm) {
    return (
      <div className="flex flex-col gap-4">
        {needsManualForm ? (
          <p className="text-sm text-muted-foreground">
            {fa.aiWizardPage.fallbackNotice}
          </p>
        ) : null}
        <RequestForm
          initialValues={draft ? draftToPrefill(draft) : undefined}
        />
      </div>
    );
  }

  const ready = draft !== null && draft.missingFields.length === 0;
  const categoryName =
    categories.find((c) => c.id === draft?.categoryId)?.name ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {fa.aiWizardPage.intro}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder={fa.aiWizardPage.inputPlaceholder}
            rows={2}
            disabled={sending}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReviewing(true);
              }}
            >
              {fa.aiWizardPage.manualFormButton}
            </Button>
            <Button
              disabled={sending || input.trim().length === 0}
              onClick={() => void handleSend()}
            >
              {sending ? fa.aiWizardPage.sending : fa.aiWizardPage.sendButton}
            </Button>
          </div>
        </CardContent>
      </Card>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {fa.aiWizardPage.draftPreviewTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DraftField
                label={fa.newRequestPage.fields.title}
                value={draft.title}
              />
              <DraftField
                label={fa.newRequestPage.fields.category}
                value={categoryName}
              />
              <DraftField
                label={fa.newRequestPage.fields.mode}
                value={draft.mode ? fa.requestMode[draft.mode] : null}
              />
              <DraftField
                label={fa.newRequestPage.fields.city}
                value={draft.city}
              />
              <DraftField
                label={fa.newRequestPage.fields.durationMinutes}
                value={
                  draft.durationMinutes != null
                    ? String(draft.durationMinutes)
                    : null
                }
              />
              <DraftField
                label={`${fa.newRequestPage.fields.budgetMinToman} – ${fa.newRequestPage.fields.budgetMaxToman}`}
                value={
                  draft.budgetMinRial != null && draft.budgetMaxRial != null
                    ? `${formatToman(draft.budgetMinRial)} – ${formatToman(draft.budgetMaxRial)}`
                    : null
                }
              />
            </dl>

            {ready ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {fa.aiWizardPage.readyNotice}
                </p>
                <Button
                  className="self-end"
                  onClick={() => {
                    setReviewing(true);
                  }}
                >
                  {fa.aiWizardPage.reviewButton}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
