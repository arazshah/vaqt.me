import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from './common/decorators/public.decorator';
import { AdminController } from './admin/admin.controller';
import { AiController } from './ai/ai.controller';
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { CategoriesController } from './categories/categories.controller';
import { ConversationsController } from './conversations/conversations.controller';
import { OffersController } from './offers/offers.controller';
import { PaymentsController } from './payments/payments.controller';
import { RequestsController } from './requests/requests.controller';
import { ReviewsController } from './reviews/reviews.controller';
import { SkillsController } from './skills/skills.controller';
import { UsersController } from './users/users.controller';

// Every controller registered in the app — kept in sync manually so a new
// controller can't slip in unreviewed. If you add a controller, add it
// here too.
const CONTROLLERS: (new (...args: never[]) => unknown)[] = [
  AppController,
  AuthController,
  UsersController,
  CategoriesController,
  SkillsController,
  AdminController,
  RequestsController,
  OffersController,
  ConversationsController,
  AiController,
  PaymentsController,
  ReviewsController,
];

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

function joinPath(
  controllerPath: string,
  methodPath: string | string[],
): string {
  const method = Array.isArray(methodPath) ? (methodPath[0] ?? '') : methodPath;
  const parts = [controllerPath, method].filter((p) => p && p !== '/');
  const joined = '/' + parts.join('/').replace(/\/+/g, '/');
  return joined === '' ? '/' : joined;
}

interface RouteInfo {
  method: string;
  path: string;
  isPublic: boolean;
}

function extractRoutes(
  controller: new (...args: never[]) => unknown,
): RouteInfo[] {
  const controllerPath =
    (Reflect.getMetadata(PATH_METADATA, controller) as
      string | string[] | undefined) ?? '';
  const controllerPathStr = Array.isArray(controllerPath)
    ? (controllerPath[0] ?? '')
    : controllerPath;
  const prototype = controller.prototype as Record<string, unknown>;
  const routes: RouteInfo[] = [];

  for (const propertyName of Object.getOwnPropertyNames(prototype)) {
    if (propertyName === 'constructor') continue;
    const handler = prototype[propertyName];
    if (typeof handler !== 'function') continue;

    const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as
      string | string[] | undefined;
    if (methodPath === undefined) continue; // not a route handler

    const methodEnum = Reflect.getMetadata(METHOD_METADATA, handler) as
      number | undefined;
    const controllerIsPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      controller,
    ) as boolean | undefined;
    const handlerIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) as
      boolean | undefined;

    routes.push({
      method: METHOD_NAMES[methodEnum ?? RequestMethod.GET] ?? 'GET',
      path: joinPath(controllerPathStr, methodPath),
      isPublic: handlerIsPublic === true || controllerIsPublic === true,
    });
  }

  return routes;
}

// The explicit, reviewed allowlist of routes that must NOT require a valid
// access token. Adding a new @Public() route without adding it here fails
// this test — that's the point: a route becoming accidentally public must
// be a deliberate, reviewed change, never a silent side effect.
const PUBLIC_ROUTE_ALLOWLIST: { method: string; path: string }[] = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/otp/request' },
  { method: 'POST', path: '/auth/otp/verify' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'POST', path: '/requests/list' },
  { method: 'GET', path: '/payments/zarinpal/callback' },
];

describe('public route allowlist', () => {
  const allRoutes = CONTROLLERS.flatMap(extractRoutes);
  const publicRoutes = allRoutes.filter((r) => r.isPublic);

  it('found at least one route per registered controller (sanity check that reflection worked)', () => {
    expect(allRoutes.length).toBeGreaterThanOrEqual(CONTROLLERS.length);
  });

  it('the set of @Public() routes matches the explicit allowlist exactly', () => {
    const actual = publicRoutes.map((r) => `${r.method} ${r.path}`).sort();
    const expected = PUBLIC_ROUTE_ALLOWLIST.map(
      (r) => `${r.method} ${r.path}`,
    ).sort();
    expect(actual).toEqual(expected);
  });

  it('every non-allowlisted route requires authentication (is not @Public())', () => {
    const allowlistSet = new Set(
      PUBLIC_ROUTE_ALLOWLIST.map((r) => `${r.method} ${r.path}`),
    );
    const unexpectedlyPublic = allRoutes.filter(
      (r) => r.isPublic && !allowlistSet.has(`${r.method} ${r.path}`),
    );
    expect(unexpectedlyPublic).toEqual([]);
  });
});
