export interface ValidationMiddleware {

  handle(message: any, bindingKey: string): Promise<boolean>;
}
