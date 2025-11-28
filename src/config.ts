import _ from "lodash";

interface LoggerConfig {
  elasticsearch: {
    index: string;
    consistency?: string;
    node: string;
    esVersion?: number;
    flushBytes?: number;
  };
}

interface ProjectConfig {
  name: string;
  version: string;
  oauth?: {
    jwt: {
      identifier: string;
    };
    providers: Record<
      string,
      {
        tokenUrl: string;
        userUrl: string;
        clientId: string;
        redirectUri?: string;
        userIdentifier: string;
        userFields: {
          name: string;
          displayName: string;
          avatarUrl: string;
          email: string;
        };
      }
    >;
  };
}

interface LinkConfig {
  [key: string]: unknown;
}

interface OpenapiConfig {
  [key: string]: unknown;
}

interface PostgresConfig {
  uri: string;
  debug?: boolean;
  sync?: boolean;
}

interface DynamodbConfig {
  region: string;
}

interface PushGatewayConfig {
  url?: string;
  jobName?: string;
  instance?: string;
  interval?: number;
}

interface MetricsConfig {
  enabled: boolean;
  url?: string;
  pushGateway: PushGatewayConfig;
  interval?: number;
}

interface Config {
  link: LinkConfig;
  project: ProjectConfig | null;
  openapi: OpenapiConfig;
  postgres: PostgresConfig | null;
  dynamodb: DynamodbConfig | null;
  pushGateway: PushGatewayConfig;
  title?: string;
  version?: string;
  logger?: LoggerConfig;
  metrics?: MetricsConfig;
}

let _config: Config = {
  link: {},
  project: null,
  openapi: {},
  postgres: null,
  dynamodb: null,
  pushGateway: {},
};

function init(config: Partial<Config> = {}): Config {
  _config = _.merge(
    {
      link: {},
      project: null,
      openapi: {},
      postgres: null,
      dynamodb: null,
      pushGateway: {},
    },
    config
  );

  return _config;
}

const getConfig = (): Config => _config;

export = Object.assign(getConfig, { init });
