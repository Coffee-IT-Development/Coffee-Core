import { SubscriberService } from './subscriber-service';
import { OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export abstract class SubscriberController implements OnApplicationBootstrap, OnModuleInit, OnModuleDestroy {

  protected subscribers: SubscriberService[];

  public async onModuleInit(): Promise<void> {
    this.subscribers = this.initializeSubscribers();
    await Promise.all(this.subscribers.map(subscriber => subscriber.subscribe()));
  }

  public async onApplicationBootstrap(): Promise<void> {
    await Promise.all(this.subscribers.map(subscriber => subscriber.start()));
  }

  public async onModuleDestroy(): Promise<void> {
    await Promise.all(this.subscribers.map(subscriber => subscriber.close()));
  }

  protected abstract initializeSubscribers(): SubscriberService[];
}
