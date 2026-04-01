import * as oracledb from "oracledb";

import { EventAdapter } from "../types/types";

export class TxEventQAdapter implements EventAdapter {
  private connection: oracledb.Connection | null = null;
  private queueCache: Map<string, oracledb.AdvancedQueue<any>> = new Map();
  private messageHandler?: (type: string, payload: object) => void;
  private isRunning: boolean = false;

  private subscriptionConnections: Map<string, oracledb.Connection> = new Map();

  constructor(
    private readonly options: {
      connectString: string;
      user: string;
      password: string;
      instantClientPath?: string;
      walletPath?: string;
      walletPassword?: string;
      consumerName?: string;
      batchSize?: number;
      waitTime?: number;
      autoCommit?: boolean;
    },
  ) {}

  async connect(): Promise<void> {
    try {
      if (this.options.instantClientPath && oracledb.thin) {
        try {
          oracledb.initOracleClient({
            libDir: this.options.instantClientPath,
            configDir: this.options.walletPath,
            walletPath: this.options.walletPath,
          });
        } catch (initError: any) {
          if (initError.code !== "NJS-509") {
            throw initError;
          }
        }
      }

      this.connection = await oracledb.getConnection({
        connectString: this.options.connectString,
        user: this.options.user,
        password: this.options.password,
        configDir: this.options.walletPath,
        walletLocation: this.options.walletPath,
        walletPassword: this.options.walletPassword,
      });

      this.isRunning = true;
    } catch (error: any) {
      console.error("[TxEventQAdapter] Error connecting:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;

    for (const [, conn] of this.subscriptionConnections) {
      try {
        await conn.close();
      } catch {
        // ignore close errors during disconnect
      }
    }
    this.subscriptionConnections.clear();

    if (this.connection) {
      try {
        this.queueCache.clear();
        await this.connection.close();
      } catch {
        // ignore close errors during disconnect
      }
      this.connection = null;
    }
  }

  private async getOrCreateQueue(
    queueName: string,
    options: any,
  ): Promise<oracledb.AdvancedQueue<any>> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    if (this.queueCache.has(queueName)) {
      return this.queueCache.get(queueName)!;
    }

    const queue = await this.connection.getQueue(queueName, options);
    this.queueCache.set(queueName, queue);
    return queue;
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    const queue = await this.getOrCreateQueue(type, {
      payloadType: oracledb.DB_TYPE_JSON,
    } as any);

    await queue.enqOne({
      payload: { topic: type, payload },
      correlation: type,
      priority: 0,
      delay: 0,
      expiration: -1,
      exceptionQueue: "",
    } as any);

    await this.connection.commit();
  }

  async subscribe(type: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Subscriber not initialized");
    }

    const queueName = `TXEVENTQ_USER.${type}`;
    const consumerName =
      this.options.consumerName || `${type.toLowerCase()}_subscriber`;

    const subConnection = await oracledb.getConnection({
      connectString: this.options.connectString,
      user: this.options.user,
      password: this.options.password,
      configDir: this.options.walletPath,
      walletLocation: this.options.walletPath,
      walletPassword: this.options.walletPassword,
    });

    this.subscriptionConnections.set(type, subConnection);

    const queue = await subConnection.getQueue(queueName, {
      payloadType: oracledb.DB_TYPE_JSON,
    });

    queue.deqOptions.wait = 5;
    queue.deqOptions.consumerName = consumerName;

    this.consumeLoop(type, queue, subConnection).catch(() => {
      // consumeLoop exits when isRunning becomes false
    });
  }

  private async consumeLoop(
    type: string,
    queue: oracledb.AdvancedQueue<any>,
    connection: oracledb.Connection,
  ): Promise<void> {
    let backoffMs = 1000;
    while (this.isRunning) {
      try {
        const message = await queue.deqOne();
        if (message) {
          if (this.messageHandler) {
            try {
              const payload = (message.payload as any)?.payload || {};
              this.messageHandler(type, payload);
            } catch {
              // callback errors don't affect message acknowledgment
            }
          }
          if (this.options.autoCommit) {
            await connection.commit();
          }
        }
        backoffMs = 1000;
      } catch {
        if (!this.isRunning) break;
        await new Promise((res) => setTimeout(res, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 30000);
      }
    }
  }

  async unsubscribe(type: string): Promise<void> {
    const conn = this.subscriptionConnections.get(type);
    if (conn) {
      try {
        await conn.close();
      } catch {
        // ignore
      }
      this.subscriptionConnections.delete(type);
    }
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  async getBacklog(topics: string[]): Promise<Map<string, number>> {
    const backlogMap = new Map<string, number>();
    if (!this.connection || !topics?.length) return backlogMap;

    const sql = `
      SELECT NVL(ENQUEUED_MSGS - DEQUEUED_MSGS, 0) AS BACKLOG
        FROM V$PERSISTENT_QUEUES
       WHERE QUEUE_NAME = :queueName
    `;

    for (const topic of topics) {
      const queueName = topic;

      try {
        const result = await this.connection.execute(
          sql,
          { queueName },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );

        const rows = (result.rows || []) as Array<{ BACKLOG: number }>;
        const val = Number(rows?.[0]?.BACKLOG ?? 0);
        backlogMap.set(topic, isNaN(val) ? 0 : val);
      } catch {
        backlogMap.set(topic, 0);
      }
    }

    return backlogMap;
  }
}
