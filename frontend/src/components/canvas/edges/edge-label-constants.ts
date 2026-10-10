import type { AuthMethod, Protocol } from "@/types/canvas";

export const protocolDisplay: Record<Protocol, string> = {
  HTTP: "HTTP",
  HTTPS: "HTTPS",
  gRPC: "gRPC",
  WebSocket: "WebSocket",
  TCP: "TCP",
  UDP: "UDP",
  AMQP: "AMQP",
  MQTT: "MQTT",
  Kafka: "Kafka",
  PostgreSQL: "PostgreSQL",
  MySQL: "MySQL",
  MongoDB: "MongoDB",
  Redis: "Redis",
  SSH: "SSH",
  SFTP: "SFTP",
  Custom: "Custom",
};

export const authDisplay: Record<AuthMethod, { label: string; color: string }> =
  {
    None: { label: "No Auth", color: "text-red-700 dark:text-red-400" },
    API_KEY: {
      label: "API Key",
      color: "text-yellow-700 dark:text-yellow-400",
    },
    JWT: { label: "JWT", color: "text-blue-700 dark:text-blue-400" },
    OAuth2: { label: "OAuth2", color: "text-green-700 dark:text-green-400" },
    mTLS: { label: "mTLS", color: "text-green-700 dark:text-green-400" },
    Basic: { label: "Basic", color: "text-orange-700 dark:text-orange-400" },
    SAML: { label: "SAML", color: "text-purple-700 dark:text-purple-400" },
    Custom: { label: "Custom", color: "text-muted-foreground" },
  };
