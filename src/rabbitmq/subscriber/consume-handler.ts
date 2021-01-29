import { ClassConstructor, plainToClass } from 'class-transformer';
import { Logger, LoggerService } from '@nestjs/common';
import { ValidationMiddleware } from './validation/validation-middleware';

export class ConsumeHandler {
  private validationMiddleware: ValidationMiddleware;
  private readonly logger: LoggerService = new Logger(ConsumeHandler.name);

  constructor(
    public readonly bindingKey: string,
    private onConsume: (message: any) => Promise<void>,
    private messageClass: ClassConstructor<any>,
  ) {
  }

  public async consume(message: any): Promise<void> {
    const transformedMessage = await plainToClass(this.messageClass, message);

    if (this.validationMiddleware) {
      const passedValidation = await this.validationMiddleware.handle(transformedMessage, this.bindingKey);
      if (!passedValidation) {
        return;
      }
    }
    this.logger.debug(`Got an event on ${this.bindingKey} with payload: ${JSON.stringify(message, null, 2)}`)
    await this.onConsume(transformedMessage);
  }

  public setValidationMiddleware(middleware: ValidationMiddleware): void {
    this.validationMiddleware = middleware;
  }
}
