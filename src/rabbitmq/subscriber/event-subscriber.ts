import { ValidationMiddleware } from './validation/validation-middleware';
import { ClassConstructor } from 'class-transformer';

export interface EventSubscriber {

  subscribe(
    bindingKey: string,
    onConsume: (message: any) => Promise<void>,
    messageClass: ClassConstructor<any>,
  ): Promise<void>;

  startReceivingMessages();

  close(): Promise<void>;

  setValidationMiddleware(middleware: ValidationMiddleware);

}
