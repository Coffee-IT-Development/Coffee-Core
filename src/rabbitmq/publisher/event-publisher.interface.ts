export interface EventPublisher {

  publishRetry<T>(message: T, routingKey: string, maxRetries?: number): Promise<void>

  publish<T>(message: T, routingKey: string): Promise<void>;

  close(): Promise<void>;

}
