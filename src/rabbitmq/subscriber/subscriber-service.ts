import { EventSubscriber } from './event-subscriber';

export abstract class SubscriberService {

  protected readonly eventSubscriber: EventSubscriber;

  protected constructor() {
    this.eventSubscriber = this.createEventSubscriber();
  }

  public abstract subscribe(): Promise<void>;

  public async start(): Promise<void> {
    await this.eventSubscriber.startReceivingMessages();
  }

  public async close(): Promise<void> {
    await this.eventSubscriber.close();
  }

  protected abstract createEventSubscriber(): EventSubscriber;
}
