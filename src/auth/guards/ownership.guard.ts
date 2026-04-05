import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { id: string; email: string };
    const userId = request.params.userId;

    if (userId && user.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
