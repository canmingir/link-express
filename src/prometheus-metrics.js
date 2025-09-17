const promClient = require('prom-client');


const dbMetrics = {
  readOps: new promClient.Counter({
    name: 'db_read_operations_total',
    help: 'Total number of database read operations',
  }),
  
  writeOps: new promClient.Counter({
    name: 'db_write_operations_total',
    help: 'Total number of database write operations',
  }),
  
  readLatency: new promClient.Histogram({
    name: 'db_read_duration_seconds',
    help: 'Database read operation duration in seconds',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  }),
  
  writeLatency: new promClient.Histogram({
    name: 'db_write_duration_seconds',
    help: 'Database write operation duration in seconds',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  })
};

module.exports = { dbMetrics, promClient };