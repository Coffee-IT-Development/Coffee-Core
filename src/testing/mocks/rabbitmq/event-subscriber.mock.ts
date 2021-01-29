import { EventSubscriber } from '../../../rabbitmq/subscriber/event-subscriber';
import { ValidationMiddleware } from '../../../rabbitmq/subscriber/validation/validation-middleware';

export class EventSubscriberMock implements EventSubscriber {
  private bindingKeyMap = {};
  private validationMiddleware: ValidationMiddleware;

  subscribe(bindingKey: string, onConsume: (message: object) => Promise<void>): Promise<void> {
    this.bindingKeyMap[bindingKey] = onConsume;
    return Promise.resolve(undefined);
  }

  close(): Promise<void> {
    return Promise.resolve(undefined);
  }

  startReceivingMessages(): Promise<void> {
    return Promise.resolve(undefined);
  }

  public hasBindingKey(bindingKey: string): boolean {
    return Object.keys(this.bindingKeyMap).includes(bindingKey);
  }

  public async triggerConsume(bindingKey: string, message: object): Promise<void> {
    const consumeFunc = this.bindingKeyMap[bindingKey];
    if (consumeFunc) {
      await consumeFunc(message);
    }
  }

  setValidationMiddleware(middleware: ValidationMiddleware) {
    this.validationMiddleware = middleware;
  }
}
