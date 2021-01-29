export interface BrokerConfigInterface {
  AMQP_CONNECTION_URI: string;
  DURABLE_EXCHANGE: boolean;
  EXCHANGE_NAME: string;
  EXCHANGE_TYPE: string;

  // Required when using the rabbitmq-subscriber
  DURABLE_QUEUES?: boolean;
  QUEUE_NAME?: string;

  // Required when using the rabbitmq-publisher
  PUBLISH_RETRY_TIMEOUT_MS?: number;
  PERSISTENT_MESSAGES?: boolean;
}
