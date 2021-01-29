# Coffee Core

The Coffee Core API library

---

## Overview
This is a core library for backend projects of Coffee IT and is meant for api projects that are using the NestJS framework.

The library contains the following packages:
  - /client - contains a ClientConnector class which can be used to connect to a microservice over TCP.
  - /logger - contains a CustomLogger class which all microservices should use to log errors, warnings and debug lines.
  - /rabbitmq - contains subscriber and publisher classes for RabbitMQ.
  - /testing - contains mock classes so the library classes can be tested.
  - /utils - contains utility functions which are often used by different microservices.

## Usage and examples

### ClientConnector
The ClientConnector class can be used to connect to a microservice over TCP so that the service directly can communicate with the other service.\
This communication is direct because the service sends a request and expects a response back, this is also known as executing a command.

This example code shows how the ClientConnector can be used:
```
@Injectable()
export class AuthService implements OnApplicationBootstrap {

  constructor(
    @Inject('AUTH_SERVICE') private readonly client: ClientProxy,
  ) {
  }

  public async onApplicationBootstrap(): Promise<void> {
    const connector = new ClientConnector(ClientConfig, this.client, 'auth-service', AuthService.name);
    await connector.connect();
  }

  public async createToken(dto: CreateTokenDto): Promise<Token> {
    return this.client.send<Token, CreateTokenDto>('createToken', dto).toPromise();
  }
}
```

The connector expects to get a configuration object injected and to get an instance of the ClientProxy class.
This ClientProxy is imported from `@nestjs/microservices`.
The ClientConnector is then going to try to connect to the microservice which is in this case the Auth-Service. 
The ClientConnector will retry to connect if this connection fails. The amount of time between reconnects depends on the ClientConfig configuration.

An ClientConfig configuration object can be:
```
export default {
  INITIAL_RETRY_TIMEOUT_MS: 500,
  MAX_RETRY_TIME_MS: 5 * 1000,
}
```

Using this configuration the client is going to try to reconnect after half a second and is going to increase this retry time until a maximum retry time of 5 seconds is reached.

### CustomLogger
The CustomLogger class is going to set the logLevels for the logger depending on the environment.  
This environment can be changed by changing the ENV environment variable.
As an example in a docker-compose file:
```
  environment:
    ENV: 'development'
```
This will set the environment to development so that you will also see log output when logger.debug is called.
You might want to change this environment on the production server, so you won't see al the debug information.

### RabbitMQ
RabbitMQ is used to publish events and to subscribe to these events. Microservices can communicate this way asynchronously in an event-driven way.

#### Publisher
The publisher folder contains all the classes that are required to publish events to RabbitMQ. \
RabbitMQPublisher is an implementation for RabbitMQ. The EventPublisherService service is going to load this class by default.

NestJs services can extend the EventPublisherService class to publish to RabbitMQ. As an example: 
```
export class UserPublisher extends EventPublisherService {

  private readonly logger: LoggerService = new CustomLogger(UserPublisher.name);
  private readonly publishRetries = 10;

  constructor(@Optional() eventPublisher?: EventPublisher) {
    super(BrokerConfig, eventPublisher);
  }

  public async publishUserCreated(dto: User): Promise<void> {
    this.logger.debug(`publishUserCreated with dto ${JSON.stringify(dto, null, 2)}`);
    await this.publisher.publishRetry<User>(dto, 'dla.user.created', this.publishRetries);
  }
}
```

A controller class can then use this publisher class to publish the event. 
A mock of the EventPublisher class can be injected through the constructor in order to test the UserPublisher class. \
The EventPublisherService is also going to need a configuration object in order to connect to RabbitMQ. As an example:
```
export default {
  AMQP_CONNECTION_URI: process.env.AMQP_CONNECTION_URI || 'amqp://localhost:5672',
  DURABLE_EXCHANGE: (typeof process.env.DURABLE_EXCHANGE === 'undefined') ? true : (process.env.DURABLE_EXCHANGE === 'true'),
  EXCHANGE_NAME: (process.env.EXCHANGE_NAME) || 'dla.topic',
  EXCHANGE_TYPE: (process.env.EXCHANGE_TYPE) || 'topic',

  PUBLISH_RETRY_TIMEOUT_MS: (parseInt(process.env.PUBLISH_RETRY_TIMEOUT_MS, 10)) || 1000,
  PERSISTENT_MESSAGES: (typeof process.env.PERSISTENT_MESSAGES === 'undefined') ? true : (process.env.PERSISTENT_MESSAGES === 'true'),
};
```

#### Subscriber
Classes from the subscriber folder can be used to subscribe to the RabbitMQ events. 
RabbitMQSubscriber is the RabbitMQ implementation. Events should **not** be consumed randomly so the RabbitMQ subscriber is only going to use one channel and connect to one queue.

A subscriber NestJS Service class can be created to consume the events. As an example:
```
export class UserSubscriber extends SubscriberService {

  private readonly logger: LoggerService = new CustomLogger(UserSubscriber.name);

  constructor() {
    super()
  }

  public async subscribe(): Promise<void> {
    const createdBindingKey = 'dla.user.created';
    await this.eventSubscriber.subscribe(createdBindingKey, async (message: UserCreatedDto) => {
      await this.handleUserCreated(message);
    }, UserCreatedDto);
  }

  public async handleUserCreated(dto: UserCreatedDto): Promise<void> {
    // Overwrite this method
  }

  protected createEventSubscriber(): EventSubscriber {
    const subscriber = RabbitMQSubscriber.getInstance(BrokerConfig);
    subscriber.setValidationMiddleware(new ClassValidationMiddleware(this.logger));
    return subscriber;
  }
}
```
The RabbitMQSubscriber instance is created in the createEventSubscriber method and the configuration file is injected.
The handleUserCreated method can then be overwritten by a different class (controller class) to handle the event. 
An example broker config file can be:
```
export default {
  AMQP_CONNECTION_URI: process.env.AMQP_CONNECTION_URI || 'amqp://localhost:5672',
  DURABLE_EXCHANGE: (typeof process.env.DURABLE_EXCHANGE === 'undefined') ? true : (process.env.DURABLE_EXCHANGE === 'true'),
  DURABLE_QUEUES: (typeof process.env.DURABLE_QUEUES === 'undefined') ? true : (process.env.DURABLE_QUEUES === 'true'),
  EXCHANGE_NAME: (process.env.EXCHANGE_NAME) || 'dla.topic',
  EXCHANGE_TYPE: (process.env.EXCHANGE_TYPE) || 'topic',
  
  QUEUE_NAME: (process.env.QUEUE_NAME) || 'subscription_queue',
};
```
**Note**: the subscriber needs to know the queue name and does not need the PUBLISH_RETRY_TIMEOUT_MS and PERSISTENT_MESSAGES values.


The SubscriberController class can be extended by a NestJS Controller to handle the events. It contains default logic to start, subscribe and close the subscribers.
A SubscriberController could look like this:
```
@Controller('subscription')
export class SubscriptionController extends SubscriberController {

  private readonly logger: LoggerService = new CustomLogger(SubscriberService.name);

  constructor(
    readonly service: SubscriptionService,
  ) {
    super();
  }

  public async createFreeSubscription(userId: string): Promise<UserSubscription> {
    this.logger.debug(`createFreeSubscription with userId ${userId}`);
    // Handle the event here
    return null;
  }

  protected initializeSubscribers(): SubscriberService[] {
    const userSubscriber = new UserSubscriber();
    userSubscriber.handleUserCreated = async (dto: UserCreatedDto) => {
      await this.createFreeSubscription(dto._id);
    }
    return [userSubscriber];
  }
}
```
The SubscriptionController is going to create Subscriber services in the initializeSubscribers method.
The Controller can overwrite event methods from the subscriber to handle the event.
handleUserCreated is overwritten in this example to create a free subscription for the user.

### Utils
The utils folder contains a validation-utils file. The subtractExceptionMessage method in this file is used to subtract the message of an exception.\
This message can then be used to throw a well formatted exception. This is often done in the bootstrap function in the main.ts file. For example:
```
async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      port: Config.PORT,
      host: '0.0.0.0',
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const errorMessage = subtractExceptionMessage(validationErrors);
      if (errorMessage) {
        return new RpcException(`${HttpStatus.BAD_REQUEST} ${errorMessage}`);
      }
      return new RpcException(`${HttpStatus.BAD_REQUEST} Validation error`);
    },
  }));

  await app.listen(() => logger.log(`${Config.SERVER_NAME} is listening to tcp port: ${Config.PORT}`));
}

bootstrap();
```

Whenever an exception occurs we subtract the message from this exception and throw a RpcException error instead.
A gateway service (like the Main Gateway) can then catch this exception and return a HttpException to the client.

### Testing
The testing folder contains mock classes that can be used to test the library classes.

The ClientProxyMock can be used to test services that are using the ClientProxy. Take this example test:
```
import { AuthService } from './auth.service';
import { ClientProxyMock } from 'coffee-core';
import { Role } from '../user/domain/role';

describe('AuthService', () => {
  const mockResult = { type: 'mockResult' };
  let proxyMock: ClientProxyMock;
  let service: AuthService;

  beforeEach(async () => {
    proxyMock = new ClientProxyMock(mockResult);
    service = new AuthService(proxyMock as any);
  });

  describe('createToken', () => {
    it('Should send with the right pattern and dto', async () => {
      // Arrange
      const userId = '5fca317f544ad17058b882df';
      const dto = { userId, role: Role.USER };

      // Act
      const result = await service.createToken(dto);

      // Assert
      expect(proxyMock.passedPattern).toBe('createToken');
      expect(proxyMock.passedDto).toEqual(dto);
      expect(result).toEqual(mockResult);
    });
  });
});
```
The ClientProxyMock is injected into the AuthService so we can call a method like createToken and compare the pattern and dto that are passed to the proxy.

The EventPublisherMock can be used to mock an EventPublisher instance. For example:
```
describe('UserPublisher', () => {
  let publisherMock: EventPublisher;
  let publisher: UserPublisher;

  beforeEach(async () => {
    publisherMock = new EventPublisherMock();
    publisher = new UserPublisher(publisherMock);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('publishUserCreated', () => {
    it('Should publish with the right dto and routingKey', async () => {
      // Arrange
      const userId = '5fe32079821248a3ab185efe';
      const dto = { ...Input.USER, _id: userId };

      const publishSpy = jest.spyOn(publisherMock, 'publishRetry');

      // Act
      await publisher.publishUserCreated(dto);

      // Assert
      expect(publishSpy).toHaveBeenCalledTimes(1);

      const routingKey = 'dla.user.created';
      const maxRetries = 10;
      expect(publishSpy).toHaveBeenCalledWith(dto, routingKey, maxRetries);
    });
  });
});
```
We mock the publishRetry method here, so we can validate the routing key and the published event.

At last, we can use the EventSubscriberMock to mock an instance of the EventSubscriber class. For example:
```
describe('UserSubscriber', () => {
  let subscriber: UserSubscriber;

  beforeEach(async () => {
    subscriber = new UserSubscriber();
  });

  describe('subscribe', () => {
    it('Should subscribe to user created events', async () => {
      // Arrange
      const eventSubscriber = new EventSubscriberMock();
      (subscriber as any).eventSubscriber = eventSubscriber;

      // Act
      await subscriber.subscribe();

      // Assert
      expect(eventSubscriber.hasBindingKey('dla.user.created')).toBeTruthy();
    });

    it('Should call handleUserCreated when consuming a user created event', async () => {
      // Arrange
      const eventSubscriber = new EventSubscriberMock();
      (subscriber as any).eventSubscriber = eventSubscriber;

      const handleSpy = jest.spyOn(subscriber, 'handleUserCreated');

      // Act
      await subscriber.subscribe();
      const message = { _id: '5f92a7bf777bbfd0ec5a1635' };
      const event = 'dla.user.created';
      await eventSubscriber.triggerConsume(event, message);

      // Assert
      expect(handleSpy).toHaveBeenCalledTimes(1);
      expect(handleSpy).toHaveBeenCalledWith(message);
    });
  });

  describe('createEventSubscriber', () => {
    it('Should create an event subscriber', async () => {
      const { eventSubscriber } = (subscriber as any);
      expect(eventSubscriber).toBeDefined();
      expect(eventSubscriber).toBeInstanceOf(RabbitMQSubscriber);
    });
  });
});
```
We can use this mock to check if the UserSubscriber is using from the right binding key.
We can also use the mock to trigger an event so we can validate if the UserSubscriber is consuming this event in the right way.
