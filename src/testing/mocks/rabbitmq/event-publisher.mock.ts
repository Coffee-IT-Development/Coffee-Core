import { EventPublisher } from '../../../rabbitmq/publisher/event-publisher.interface';

export class EventPublisherMock implements EventPublisher {
  public publishRetry<T>(message: T, routingKey: string, maxRetries?: number): Promise<void> {
    return Promise.resolve(undefined);
  }

  public publish<T>(message: T, routingKey: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  public close(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
