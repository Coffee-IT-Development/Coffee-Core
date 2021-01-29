import * as amqp from 'amqplib';
import { Channel, Connection } from 'amqplib';
import { EventPublisher } from './event-publisher.interface';
import { Logger, LoggerService } from '@nestjs/common';
import { CustomLogger } from '../../logger/custom-logger';
import { BrokerConfigInterface } from '../subscriber/broker-config.interface';

// Inspired by: https://docs.nestjs.com/fundamentals/custom-providers and https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html
export class RabbitMQPublisher implements EventPublisher {

  private logger: LoggerService = new CustomLogger(RabbitMQPublisher.name);
  private channel: Channel;
  private server: Connection;

  constructor(private readonly config: BrokerConfigInterface) {
  }

  public async publishRetry<T>(message: T, routingKey: string, maxRetries = 10): Promise<void> {
    await this.publishAndRetry(message, routingKey, 0, maxRetries);
  }

  private async publishAndRetry<T>(message: T, routingKey: string, retries = 0, maxRetries = 10): Promise<void> {
    try {
      await this.publish(message, routingKey);
    } catch (e) {
      const timeOut = setTimeout(async () => {
        retries += 1;
        this.logger.error(`Got error when publishing to ${routingKey}. Retrying for the ${retries}th time. ${e}`);

        try {
          await this.publish(message, routingKey);
        } catch (e) {
          await this.publishRetry(message, routingKey, retries);
        }
      }, this.config.PUBLISH_RETRY_TIMEOUT_MS * (2 ** retries));

      if (retries >= maxRetries) {
        clearTimeout(timeOut);
        Logger.error(`Stopped retrying to publish to ${routingKey} after ${retries} times.`)
      }
    }
  }

  public async publish<T>(message: T, routingKey: string): Promise<void> {
    const channel = await this.getChannel();

    const createdExchange = await channel.assertExchange(
      this.config.EXCHANGE_NAME, this.config.EXCHANGE_TYPE, { durable: this.config.DURABLE_EXCHANGE },
    );

    const byteMessage = Buffer.from(JSON.stringify(message));
    const options = { persistent: this.config.PERSISTENT_MESSAGES };

    await channel.publish(createdExchange.exchange, routingKey, byteMessage, options);
    this.logger.debug(`Published event to ${routingKey} with payload ${JSON.stringify(message, null, 2)}`);
  }

  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
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
    });

    this.channel.on('err', () => {
      this.logger.debug('Channel got an error');
      this.channel = undefined;
    });

    return this.channel;
  }

  private async getServer(): Promise<Connection> {
    if (this.server) {
      return this.server;
    }
    this.server = await this.connect();

    this.server.on('close', () => {
      this.server = undefined;
      this.logger.debug('RabbitMQ server closed');
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
}
