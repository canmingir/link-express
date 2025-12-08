import * as oracledb from "oracledb";

import { EventAdapter } from "../types/types";

export class TxEventQAdapter implements EventAdapter {
  private connection: oracledb.Connection | null = null;
  private queue: oracledb.AdvancedQueue<any> | null = null;
  private queueCache: Map<string, oracledb.AdvancedQueue<any>> = new Map();
  private messageHandler?: (type: string, payload: object) => void;
  private isRunning: boolean = false;

  constructor(
    private readonly options: {
      connectString: string;
      user: string;
      password: string;
      instantClientPath?: string;
      walletPath?: string;
      consumerName?: string;
      batchSize?: number;
      waitTime?: number;
      autoCommit?: boolean;
    }
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
          console.log("Oracle Thick client initialized");
        } catch (initError: any) {
          if (initError.code !== "NJS-509") {
            throw initError;
          }
          console.log("Oracle Thick client already initialized");
        }
      }

      this.connection = await oracledb.getConnection({
        connectString: this.options.connectString,
        user: this.options.user,
        password: this.options.password,
        configDir: this.options.walletPath,
        walletPath: this.options.walletPath,
      });

      this.isRunning = true;

      console.log("TxEventQ adapter connected successfully");
    } catch (error: any) {
      console.error("Failed to connect to TxEventQ:", error.message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;

    if (this.connection) {
      try {
        this.queueCache.clear();

        await this.connection.close();
        console.log("TxEventQ connection closed");
      } catch (error) {
        console.error("Error closing TxEventQ connection:", error);
      }
      this.connection = null;
      this.queue = null;
    }
  }

  private async getOrCreateQueue(
    queueName: string,
    options: any
  ): Promise<oracledb.AdvancedQueue<any>> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    if (this.queueCache.has(queueName)) {
      return this.queueCache.get(queueName)!;
    }

    const queue = await this.connection.getQueue(queueName, options);
    this.queueCache.set(queueName, queue);

    console.log(`Queue ${queueName} cached`);

    return queue;
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    const queueName = type;

    this.queue = await this.getOrCreateQueue(queueName, {
      payloadType: oracledb.DB_TYPE_JSON,
    } as any);

    const message = {
      topic: type,
      payload: payload,
    };

    this.queue
      .enqOne({
        payload: message,
        correlation: type,
        priority: 0,
        delay: 0,
        expiration: -1,
        exceptionQueue: "",
      } as any)
      .then(() => {
        this.connection.commit();
      });
  }

  async subscribe(type: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Subscriber not initialized");
    }
    this.isRunning = true;

    const queueName = `TXEVENTQ_USER.${type}`;

    this.queue = await this.getOrCreateQueue(queueName, {
      payloadType: oracledb.DB_TYPE_JSON,
    });

    this.queue.deqOptions.wait = 5000;
    this.queue.deqOptions.consumerName =
      this.options.consumerName || `${type.toLowerCase()}_subscriber`;
    try {
      while (this.isRunning) {
        let messages: oracledb.AdvancedQueueMessage[] = [];

        const message = await this.queue.deqOne();
        if (message) {
          messages = [message];
        }
        if (messages && messages.length > 0) {
          if (this.messageHandler) {
            try {
              const payload = message.payload.payload || {};
              this.messageHandler(type, payload);
            } catch (error) {
              console.error(
                `Error processing message for topic ${type}:`,
                error
              );
            }
          }
          if (this.options.autoCommit) {
            await this.connection.commit();
            console.log(
              `Transaction committed for ${messages.length} message(s)`
            );
          }
        }
      }
    } catch (error) {
      console.error("Fatal error during consumption:", error);
      throw error;
    }
  }

  async unsubscribe(type: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Subscriber not initialized");
    }
    this.isRunning = false;
    this.queue = null;
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  async getBacklog(topics: string[]): Promise<Map<string, number>> {
    const backlogMap = new Map<string, number>();
    if (!this.connection || !topics?.length) return backlogMap;

    const sql = `
      SELECT NVL(SUM(s.ENQUEUED_MSGS - s.DEQUEUED_MSGS), 0) AS BACKLOG
        FROM GV$AQ_SHARDED_SUBSCRIBER_STAT s
        JOIN USER_QUEUES q
          ON q.QID = s.QUEUE_ID
        JOIN USER_QUEUE_SUBSCRIBERS sub
          ON sub.SUBSCRIBER_ID = s.SUBSCRIBER_ID
         AND sub.QUEUE_NAME = q.NAME
       WHERE q.NAME IN (:queueName1, :queueName2)
         AND (:consumerName IS NULL OR sub.CONSUMER_NAME = :consumerName)
    `;

    const consumerName =
      typeof this.options.consumerName === "string"
        ? this.options.consumerName
        : null;

    for (const topic of topics) {
      const queueName1 = `TXEVENTQ_USER.${topic}`;
      const queueName2 = topic;

      try {
        const result = await this.connection.execute(
          sql,
          { queueName1, queueName2, consumerName },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rows = (result.rows || []) as Array<{ BACKLOG: number }>;
        const val = Number(rows?.[0]?.BACKLOG ?? 0);
        backlogMap.set(topic, isNaN(val) ? 0 : val);
      } catch (err) {
        console.error(`Backlog query failed for topic ${topic}:`, err);
        backlogMap.set(topic, 0);
      }
    }

    return backlogMap;
  }
}
