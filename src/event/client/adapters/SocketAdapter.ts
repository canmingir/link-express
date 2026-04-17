import { Socket, io } from "socket.io-client";

import { EventAdapter, EventPayload } from "../types/types";

export class SocketAdapter implements EventAdapter {
  private socket: Socket | null = null;
  private messageHandler?: (type: string, payload: EventPayload) => void;
  private readonly subscribedTypes = new Set<string>();

  constructor(
    private readonly options: {
      host: string;
      port?: number;
      protocol: string;
    },
  ) {}

  async connect(): Promise<void> {
    const { host, port, protocol } = this.options;
    const socketPath = port
      ? `${protocol}://${host}:${port}`
      : `${protocol}://${host}`;

    this.socket = io(socketPath);
    await this.waitForSocketConnection(this.socket, socketPath);

    this.socket.on("connect", () => {
      this.resubscribeAll();
    });

    this.socket.on(
      "event",
      ({ type, payload }: { type: string; payload: EventPayload }) => {
        if (this.messageHandler) {
          this.messageHandler(type, payload);
        }
      },
    );
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscribedTypes.clear();
  }

  async publish(type: string, payload: EventPayload): Promise<void> {
    const socket = this.ensureConnected();
    socket.emit("publish", { type, payload });
  }

  async subscribe(type: string): Promise<void> {
    this.subscribedTypes.add(type);
    if (this.socket?.connected) {
      this.socket.emit("subscribe", type);
    }
    // If not yet connected, resubscribeAll() will send it on connect
  }

  async unsubscribe(type: string): Promise<void> {
    this.subscribedTypes.delete(type);
    if (this.socket?.connected) {
      this.socket.emit("unsubscribe", type);
    }
  }

  onMessage(handler: (type: string, payload: EventPayload) => void): void {
    this.messageHandler = handler;
  }

  private ensureConnected(): Socket {
    if (!this.socket || this.socket.connected === false) {
      throw new Error("Socket not connected");
    }
    return this.socket;
  }

  private async waitForSocketConnection(
    socket: Socket,
    socketPath: string,
  ): Promise<void> {
    if (socket.connected) {
      return;
    }

    if (typeof socket.once !== "function" || typeof socket.off !== "function") {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Socket connection timeout: ${socketPath}`));
      }, 5000);

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onConnectError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
      };

      socket.once("connect", onConnect);
      socket.once("connect_error", onConnectError);
    });
  }

  private resubscribeAll(): void {
    if (!this.socket || this.socket.connected === false) {
      return;
    }

    this.subscribedTypes.forEach((type) => {
      this.socket!.emit("subscribe", type);
    });
  }
}
