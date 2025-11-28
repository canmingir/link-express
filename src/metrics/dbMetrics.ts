import promClient from "prom-client";

interface PushgatewayConfig {
  url: string;
  jobName: string;
  instance?: string;
  interval: number;
}

interface MetricsConfig {
  url?: string;
  pushGateway: {
    jobName?: string;
    instance?: string;
  };
  interval?: number;
}

class DBMetrics {
  registry: promClient.Registry;
  pushgatewayInterval: NodeJS.Timeout | null;
  pushgatewayConfig: PushgatewayConfig | null;
  dbReadOps: promClient.Counter<string>;
  dbWriteOps: promClient.Counter<string>;
  dbReadLatency: promClient.Histogram<string>;
  dbWriteLatency: promClient.Histogram<string>;

  constructor() {
    this.registry = new promClient.Registry();
    this.pushgatewayInterval = null;
    this.pushgatewayConfig = null;

    this.dbReadOps = new promClient.Counter({
      name: "db_read_operations_total",
      help: "Total number of database read operations",
      registers: [this.registry],
    });

    this.dbWriteOps = new promClient.Counter({
      name: "db_write_operations_total",
      help: "Total number of database write operations",
      registers: [this.registry],
    });

    this.dbReadLatency = new promClient.Histogram({
      name: "db_read_duration_seconds",
      help: "Database read operation duration in seconds",
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.dbWriteLatency = new promClient.Histogram({
      name: "db_write_duration_seconds",
      help: "Database write operation duration in seconds",
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });
  }

  recordDbRead(): () => number {
    this.dbReadOps.inc();
    return this.dbReadLatency.startTimer();
  }

  recordDbWrite(): () => number {
    this.dbWriteOps.inc();
    return this.dbWriteLatency.startTimer();
  }

  startPushgateway(metrics: MetricsConfig): void {
    this.pushgatewayConfig = {
      url: metrics.url || "http://localhost:9091",
      jobName: metrics.pushGateway.jobName || "api",
      instance: metrics.pushGateway.instance || "database",
      interval: metrics.interval || 15000,
    };

    this.stopPushgateway();

    this.pushgatewayInterval = setInterval(() => {
      this.pushMetricsToGateway();
    }, this.pushgatewayConfig.interval);

    console.log(
      `Started pushing metrics to Pushgateway every ${this.pushgatewayConfig.interval}ms`
    );
  }

  stopPushgateway(): void {
    if (this.pushgatewayInterval) {
      clearInterval(this.pushgatewayInterval);
      this.pushgatewayInterval = null;
      console.log("Stopped pushing metrics to Pushgateway");
    }
  }

  async pushMetricsToGateway(): Promise<void> {
    if (!this.pushgatewayConfig) {
      throw new Error(
        "Pushgateway not configured. Call startPushgateway() first."
      );
    }

    try {
      const body = await this.registry.metrics();
      let url = `${this.pushgatewayConfig.url}/metrics/job/${this.pushgatewayConfig.jobName}`;

      if (this.pushgatewayConfig.instance) {
        url += `/instance/${this.pushgatewayConfig.instance}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("Metrics pushed to Pushgateway successfully");
    } catch (err) {
      console.error("Failed to push metrics to Pushgateway:", err);
    }
  }

  getPushgatewayConfig(): PushgatewayConfig | null {
    return this.pushgatewayConfig;
  }
}

export { DBMetrics };
