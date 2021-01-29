import * as amqp from 'amqplib';
import { Channel, Connection } from 'amqplib';
import { EventSubscriber } from './event-subscriber';
import { Logger, LoggerService } from '@nestjs/common';
import { ConsumeHandler } from './consume-handler';
import { ValidationMiddleware } from './validation/validation-middleware';
import { ClassConstructor } from 'class-transformer';
import { BrokerConfigInterface } from './broker-config.interface';

// Inspired by: https://docs.nestjs.com/fundamentals/custom-providers and https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html
export class RabbitMQSubscriber implements EventSubscriber {
  private static instance: RabbitMQSubscriber;

  private channel: Channel;
  private server: Connection;
  private readonly consumeHandlers: ConsumeHandler[] = [];
  private readonly queueName;
  private readonly logger: LoggerService = new Logger(RabbitMQSubscriber.name);

  private readonly eventRetryTimeoutSeconds = 2 * 1000;
  private readonly consumeTimeoutSeconds = 5 * 1000;
  private readonly autoAcknowledge = false;
  private isConsuming = false;

  private constructor(
    private readonly config: BrokerConfigInterface,
  ) {
    // private
    this.queueName = config.QUEUE_NAME;
  }

  public async subscribe(
    bindingKey: string,
    onConsume: (message: Record<string, unknown>) => Promise<void>,
    messageClass: ClassConstructor<any>,
  ): Promise<void> {
    let channel;
    try {
      channel = await this.getChannel();
    } catch (e) {
      this.logger.error(`Got an error when subscribing for key ${bindingKey}`);

      setTimeout(() => {
        this.logger.debug(`Retrying subscribe after channel error for key ${bindingKey}`);
        this.subscribe(bindingKey, onConsume, messageClass);
      }, this.eventRetryTimeoutSeconds)
      return;
    }

    channel.on('close', () => {
      this.logger.debug(`Channel closed for key ${bindingKey}`);
      this.subscribe(bindingKey, onConsume, messageClass);
    });

    try {
      await this.startEventSubscribe(channel, bindingKey, onConsume, messageClass);
    } catch (e) {
      this.logger.error(`Got an error when consuming for key ${bindingKey}`);

      setTimeout(() => {
        this.logger.debug(`Retrying subscribe after consume error for key ${bindingKey}`);
        this.subscribe(bindingKey, onConsume, messageClass);
      }, this.eventRetryTimeoutSeconds)
    }
  }

  private async startEventSubscribe(
    channel: Channel,
    bindingKey: string, onConsume: (message: Record<string, unknown>) => Promise<void>,
    messageClass: ClassConstructor<any>,
  ) {
    this.consumeHandlers.push(new ConsumeHandler(bindingKey, onConsume, messageClass));

    const exchangeName = this.config.EXCHANGE_NAME;
    await channel.assertExchange(
      exchangeName, this.config.EXCHANGE_TYPE, { durable: this.config.DURABLE_EXCHANGE },
    );

    const createdQueue = await channel.assertQueue(this.queueName, { durable: this.config.DURABLE_QUEUES });
    await channel.bindQueue(createdQueue.queue, exchangeName, bindingKey);
    this.logger.debug(`Subscriber is now consuming on ${bindingKey}`);
  }

  public async startReceivingMessages(): Promise<void> {
    if (this.isConsuming) {
      return;
    }

    let channel;
    try {
      channel = await this.getChannel();
    } catch (e) {
      this.logger.error('Got an error while getting the channel to receive messages.');
      setTimeout(() => {
        this.startReceivingMessages();
      }, this.consumeTimeoutSeconds);
      return;
    }

    this.isConsuming = true;
    await channel.consume(this.queueName, async (msg) => {
      const { content } = msg;
      if (!content) {
        return;
      }

      const { routingKey } = msg.fields;
      const consumeHandler = this.findConsumeHandler(routingKey);
      if (!consumeHandler) {
        this.logger.debug(`Could not find consume handler for routingKey: ${routingKey}`);
        channel.nack(msg, false, true);
        return;
      }

      const messageObject = JSON.parse(content.toString());
      await consumeHandler.consume(messageObject);
      channel.ack(msg);
    }, { noAck: this.autoAcknowledge, exclusive: true });
  }

  private findConsumeHandler(routingKey: string): ConsumeHandler {
    return this.consumeHandlers.find(handler => handler.bindingKey === routingKey);
  }

  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
  }

  public setValidationMiddleware(middleware: ValidationMiddleware): void {
    this.consumeHandlers.forEach(handler => handler.setValidationMiddleware(middleware));
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }
    const server = await this.getServer();
    this.channel = await server.createChannel();

    this.channel.on('close', () => {
      this.logger.debug('Channel closed');
      this.channel = undefined;

      if (this.isConsuming) {
        this.isConsuming = false;
        this.startReceivingMessages();
      }
      this.isConsuming = false;
    });

    this.channel.on('err', () => {
      this.logger.debug('Channel got an error');
      this.channel = undefined;
      this.isConsuming = false;
    });
    return this.channel;
  }

  private async getServer(): Promise<Connection> {
    if (this.server) {
      return this.server;
    }
    this.server = await this.connect();

    this.server.on('close', () => {
      this.logger.debug('RabbitMQ server closed');
      this.server = undefined;
    });

    this.server.on('err', () => {
      this.logger.debug('RabbitMQ server got an error');
      this.server = undefined;
    });
    return this.server;
  }

  private async connect(): Promise<Connection> {
    return amqp.connect(this.config.AMQP_CONNECTION_URI);
  }

  public static getInstance(config: BrokerConfigInterface): RabbitMQSubscriber {
    if (!RabbitMQSubscriber.instance) {
      RabbitMQSubscriber.instance = new RabbitMQSubscriber(config);
    }
    return RabbitMQSubscriber.instance;
  }
}
