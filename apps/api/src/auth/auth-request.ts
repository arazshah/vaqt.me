import type { Request } from 'express';
import type { AccessTokenPayload } from './session/token.service';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}
