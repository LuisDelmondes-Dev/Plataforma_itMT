import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { lastValueFrom, Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { TenantRequest } from './tenant-context.guard';

/** Mantém SET LOCAL e o mesmo client durante toda a execução do handler. */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    return new Observable((subscriber) => {
      void this.db.withTenantTransaction(req.tenantContext!, () => lastValueFrom(next.handle()))
        .then((valor) => { subscriber.next(valor); subscriber.complete(); })
        .catch((erro) => subscriber.error(erro));
    });
  }
}
