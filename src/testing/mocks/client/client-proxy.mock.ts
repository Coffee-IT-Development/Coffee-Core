import { Observable } from 'rxjs';

export class ClientProxyMock {
  public passedPattern: string;
  public passedDto: any;

  constructor(private readonly mockResult: any) {
  }

  public send(pattern: string, dto: any): Observable<any> {
    this.passedPattern = pattern;
    this.passedDto = dto;

    return new Observable((observer) => {
      observer.next(this.mockResult);
      observer.complete();
    });
  }
}
