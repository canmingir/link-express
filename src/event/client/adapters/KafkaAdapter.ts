import { Consumer, Kafka, Producer } from "kafkajs";

import { EventAdapter } from "../types/types";

export class KafkaAdapter implements EventAdapter {
  private kafka: Kafka;
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private messageHandler?: (type: string, payload: object) => void;

  constructor(
    private readonly options: {
      clientId: string;
      brokers: string[];
      groupId: string;
      topics: string[]; 
    }
  ) {
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
    });
  }

  async connect(): Promise<void> {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.consumer = this.kafka.consumer({ groupId: this.options.groupId });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [/^(?!__).*$/],
      fromBeginning: false,
    });
    await this.consumer.run({
      partitionsConsumedConcurrently: 160,
      eachMessage: async ({ topic, message }) => {
        if (topic.startsWith("__")) {
          return;
        }

        if (this.messageHandler) {
          try {
            const payload = JSON.parse(message.value?.toString() || "{}");
            this.messageHandler(topic, payload);
          } catch (error) {
            console.error(
              `Error processing message for topic ${topic}:`,
              error
            );
          }
        }
      },
    });
    console.log(`Kafka consumer connected`);
  }

  async disconnect(): Promise<void> {
    if (this.consumer) {
      await this.consumer.stop();
      await this.consumer.disconnect();
      this.consumer = null;
    }
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.producer) {
      throw new Error("Producer not connected");
    }
    this.producer.send({
      topic: type,
      messages: [{ value: JSON.stringify(payload) }],
    }).then(() => {
      console.log(`Message published to topic ${type}`);
    }).catch((error) => {
      console.error(`Error publishing message to topic ${type}:`, error);
      return Promise.reject(error);
    });
  }

  async subscribe(type: string): Promise<void> {
    // No-op: EventManager handles callback registration in memory
  }

  async unsubscribe(type: string): Promise<void> {
    // No-op: EventManager handles callback removal in memory
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  async getBacklog(topics: string[]): Promise<Map<string, number>> {
    const backlogMap = new Map<string, number>();

    if (topics.length === 0) {
      return backlogMap;
    }

    const admin = this.kafka.admin();
    await admin.connect();

    try {
      for (const topic of topics) {
        const offsetsResponse = await admin.fetchOffsets({
          groupId: this.options.groupId,
          topics: [topic],
        });

        const topicOffsets = await admin.fetchTopicOffsets(topic);
        let totalLag = 0;

        const topicResponse = offsetsResponse.find((r) => r.topic === topic);
        if (topicResponse) {
          topicResponse.partitions.forEach((partitionOffset) => {
            const latestOffset = topicOffsets.find(
              (to) => to.partition === partitionOffset.partition
            );

            if (latestOffset) {
              const consumerOffset = parseInt(partitionOffset.offset);
              const latestOffsetValue = parseInt(latestOffset.offset);
              totalLag += Math.max(0, latestOffsetValue - consumerOffset);
            }
          });
        }

        backlogMap.set(topic, totalLag);
      }
    } finally {
      await admin.disconnect();
    }

    return backlogMap;
  }
}
