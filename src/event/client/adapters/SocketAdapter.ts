import { Socket, io } from "socket.io-client";

import { EventAdapter, EventPayload } from "../types/types";

export class SocketAdapter implements EventAdapter {
  private static readonly DEFAULT_CONNECT_TIMEOUT_MS = 5000;
  private static readonly LOCAL_LISTENER_CONNECT_TIMEOUT_MS = 30000;
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

    this.socket.on("connect", () => {
      this.resubscribeAll();
    });

    await this.waitForSocketConnection(this.socket, socketPath);

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

    const timeoutMs = this.isLocalListenerTarget()
      ? SocketAdapter.LOCAL_LISTENER_CONNECT_TIMEOUT_MS
      : SocketAdapter.DEFAULT_CONNECT_TIMEOUT_MS;

    await new Promise<void>((resolve, reject) => {
      let lastConnectError: Error | undefined;

      const timeoutId = setTimeout(() => {
        cleanup();
        const reason = lastConnectError?.message
          ? ` Last connect error: ${lastConnectError.message}`
          : "";
        reject(new Error(`Socket connection timeout (${timeoutMs}ms): ${socketPath}.${reason}`));
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onConnectError = (error: Error) => {
        lastConnectError = error;
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
      };

      socket.once("connect", onConnect);
      socket.on("connect_error", onConnectError);
    });
  }

  private isLocalListenerTarget(): boolean {
    const { host, port } = this.options;
    const normalizedHost = host.trim().toLowerCase();
    const isLocalHost =
      normalizedHost === "localhost" ||
      normalizedHost === "127.0.0.1" ||
      normalizedHost === "::1";
    return isLocalHost && port === 8080;
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
