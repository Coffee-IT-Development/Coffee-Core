import { Injectable, Optional } from '@nestjs/common';
import { EventPublisher } from './event-publisher.interface';
import { RabbitMQPublisher } from './rabbitmq-publisher';
import { BrokerConfigInterface } from '../subscriber/broker-config.interface';

@Injectable()
export class EventPublisherService {
  protected readonly publisher: EventPublisher;

  constructor(config: BrokerConfigInterface, @Optional() eventPublisher?: EventPublisher) {
    this.publisher = eventPublisher ? eventPublisher : new RabbitMQPublisher(config);
  }
}
