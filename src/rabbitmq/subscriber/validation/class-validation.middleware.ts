import { validateOrReject } from 'class-validator';
import { LoggerService } from '@nestjs/common';
import { ValidationMiddleware } from './validation-middleware';

export class ClassValidationMiddleware implements ValidationMiddleware {

  constructor(private readonly logger: LoggerService) {
  }

  public async handle(message: Record<string, unknown>, bindingKey: string): Promise<boolean> {
    try {
      await validateOrReject(message);
    } catch (errors) {
      this.logger.error(`Validation failed for ${bindingKey} event. Errors: ${errors}`);
      return false;
    }
    return true;
  }
}
