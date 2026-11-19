import { Injectable } from '@nestjs/common';
import type { MessengerPort } from './messenger.port';

/** BALE_PROVIDER=disabled: no messenger; the dispatcher falls back to SMS. */
@Injectable()
export class DisabledMessengerAdapter implements MessengerPort {
  sendMessage(): Promise<void> {
    return Promise.resolve();
  }
  editMessage(): Promise<void> {
    return Promise.resolve();
  }
  answerCallback(): Promise<void> {
    return Promise.resolve();
  }
}
