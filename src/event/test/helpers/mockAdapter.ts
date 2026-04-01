import { EventAdapter } from "../../client/types/types";

export class MockAdapter implements EventAdapter {
  public connected = false;
  public published: Array<{ type: string; payload: object }> = [];
  public subscribed: string[] = [];
  public unsubscribedTypes: string[] = [];
  private handler?: (type: string, payload: object) => void;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async publish(type: string, payload: object): Promise<void> {
    this.published.push({ type, payload });
  }

  async subscribe(type: string): Promise<void> {
    this.subscribed.push(type);
  }

  async unsubscribe(type: string): Promise<void> {
    this.unsubscribedTypes.push(type);
    this.subscribed = this.subscribed.filter((t) => t !== type);
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.handler = handler;
  }

  /** Simulate an incoming message from the transport */
  simulateMessage(type: string, payload: object): void {
    this.handler?.(type, payload);
  }
}
