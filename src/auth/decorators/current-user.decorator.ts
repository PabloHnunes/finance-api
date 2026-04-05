import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (
    data: keyof { id: string; email: string } | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as { id: string; email: string };
    return data ? user?.[data] : user;
  },
);
