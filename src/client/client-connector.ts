import { ClientProxy } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ClientConfigInterface } from './client-config.interface';

export class ClientConnector {

  constructor(
    private readonly config: ClientConfigInterface,
    private readonly client: ClientProxy,
    private readonly serviceName: string,
    private readonly context: string,
  ) {
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      Logger.log(`Connected to ${this.serviceName}`, this.context);
    } catch (e) {
      await this.retryConnection(0);
    }
  }

  private async retryConnection(retries: number): Promise<void> {
    setTimeout(async () => {
      retries += 1;
      Logger.log(`Retrying ${this.serviceName} connection: ${retries}th time`, this.context);

      try {
        await this.client.connect()
        Logger.log(`Connected to ${this.serviceName}`, this.context);
      } catch (e) {
        await this.retryConnection(retries);
      }
    }, this.getRetryTime(retries));
  }

  private getRetryTime(retries: number) {
    const time = this.config.INITIAL_RETRY_TIMEOUT_MS * (2 ** retries);
    return time > this.config.MAX_RETRY_TIME_MS ? this.config.MAX_RETRY_TIME_MS : time;
  }
}
