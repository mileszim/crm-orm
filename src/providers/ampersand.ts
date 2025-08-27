import { AmpersandTransport, AmpersandTransportRequest, AmpersandTransportResponse } from '../core/types';

export interface AmpersandClientLike {
  request<T = unknown>(req: AmpersandTransportRequest): Promise<AmpersandTransportResponse<T>>;
}

export class AmpersandAdapter implements AmpersandTransport {
  constructor(private readonly client: AmpersandClientLike) {}

  request<TResponse = unknown>(req: AmpersandTransportRequest): Promise<AmpersandTransportResponse<TResponse>> {
    return this.client.request<TResponse>(req);
  }
}


