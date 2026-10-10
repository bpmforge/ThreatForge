/**
 * Lucidchart diagram parser
 * Supports CSV export format from Lucidchart
 */
import type { ComponentType } from "@/types/canvas";
import type {
  ParsedDiagram,
  ParsedShape,
  ParsedConnection,
  ParsedGroup,
} from "../../types";

interface LucidRow {
  id: string;
  name: string;
  shapeLibrary?: string;
  pageId?: string;
  containedBy?: string;
  linkedTo?: string;
  sourceArrow?: string;
  destinationArrow?: string;
  lineSource?: string;
  lineDestination?: string;
  textArea1?: string;
  textArea2?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  [key: string]: string | undefined;
}

export function parseLucidchartCsv(content: string): ParsedDiagram {
  const shapes: ParsedShape[] = [];
  const connections: ParsedConnection[] = [];
  const groups: ParsedGroup[] = [];

  const lines = content.split("\n");
  if (lines.length < 2) {
    return { source: "lucidchart", shapes, connections, groups, metadata: {} };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => headerMap.set(h.toLowerCase().trim(), i));

  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row = mapRowToObject(headers, values);

    // Skip if no ID
    if (!row.id) continue;

    // Check if this is a line/connection
    if (row.lineSource && row.lineDestination) {
      connections.push({
        id: row.id,
        sourceId: row.lineSource,
        targetId: row.lineDestination,
        label: row.textArea1 || row.name || "",
      });
    }
    // Check if this is a container/group
    else if (
      row.shapeLibrary?.toLowerCase().includes("container") ||
      row.name?.toLowerCase().includes("boundary") ||
      row.name?.toLowerCase().includes("group")
    ) {
      groups.push({
        id: row.id,
        label: row.name || row.textArea1 || "Group",
        childIds: [],
        bounds: {
          x: parseFloat(row.x || "0"),
          y: parseFloat(row.y || "0"),
          width: parseFloat(row.width || "300"),
          height: parseFloat(row.height || "200"),
        },
      });
    }
    // Otherwise it's a shape
    else if (row.name || row.textArea1) {
      const componentType = inferLucidchartType(row);
      shapes.push({
        id: row.id,
        label: row.name || row.textArea1 || "Component",
        type: row.shapeLibrary || "rectangle",
        inferredType: componentType,
        position: {
          x: parseFloat(row.x || "0"),
          y: parseFloat(row.y || "0"),
        },
        size: {
          width: parseFloat(row.width || "120"),
          height: parseFloat(row.height || "60"),
        },
        properties: {
          containedBy: row.containedBy,
          linkedTo: row.linkedTo,
        },
      });

      // Add to parent group if contained
      if (row.containedBy) {
        const parentGroup = groups.find((g) => g.id === row.containedBy);
        if (parentGroup) {
          parentGroup.childIds.push(row.id);
        }
      }
    }
  }

  return {
    source: "lucidchart",
    shapes,
    connections,
    groups,
    metadata: { title: "Lucidchart Diagram" },
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function mapRowToObject(headers: string[], values: string[]): LucidRow {
  const obj: Record<string, string> = {};
  headers.forEach((header, i) => {
    const key = normalizeHeader(header);
    obj[key] = values[i] || "";
  });
  return obj as LucidRow;
}

function normalizeHeader(header: string): string {
  // Convert "Text Area 1" to "textArea1", "Line Source" to "lineSource", etc.
  return header
    .trim()
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function inferLucidchartType(row: LucidRow): ComponentType {
  const shapeLib = (row.shapeLibrary || "").toLowerCase();
  const name = (row.name || "").toLowerCase();
  const text = (row.textArea1 || "").toLowerCase();
  const combined = `${shapeLib} ${name} ${text}`;

  // AWS shapes
  if (shapeLib.includes("aws")) {
    if (combined.includes("ec2")) return "AWS_EC2";
    if (combined.includes("lambda")) return "AWS_LAMBDA";
    if (combined.includes("rds") || combined.includes("aurora"))
      return "AWS_RDS";
    if (combined.includes("s3")) return "AWS_S3";
    if (combined.includes("dynamodb")) return "AWS_DYNAMODB";
    if (combined.includes("api gateway") || combined.includes("apigateway"))
      return "AWS_API_GATEWAY";
    if (combined.includes("cloudfront")) return "AWS_CLOUDFRONT";
    if (combined.includes("elb") || combined.includes("load balancer"))
      return "AWS_ELB";
    if (combined.includes("sqs")) return "AWS_SQS";
    if (combined.includes("sns")) return "AWS_SNS";
    if (combined.includes("cognito")) return "AWS_COGNITO";
    if (combined.includes("kms")) return "AWS_KMS";
    if (combined.includes("waf")) return "AWS_WAF";
    if (combined.includes("vpc")) return "AWS_VPC";
    return "AWS_EC2";
  }

  // GCP shapes
  if (shapeLib.includes("gcp") || shapeLib.includes("google cloud")) {
    if (combined.includes("compute")) return "GCP_COMPUTE";
    if (combined.includes("cloud functions") || combined.includes("functions"))
      return "GCP_FUNCTIONS";
    if (combined.includes("cloud sql") || combined.includes("sql"))
      return "GCP_CLOUDSQL";
    if (combined.includes("storage")) return "GCP_STORAGE";
    if (combined.includes("pubsub") || combined.includes("pub/sub"))
      return "GCP_PUBSUB";
    if (combined.includes("bigquery")) return "GCP_BIGQUERY";
    if (combined.includes("gke") || combined.includes("kubernetes"))
      return "GCP_GKE";
    return "GCP_COMPUTE";
  }

  // Azure shapes
  if (shapeLib.includes("azure")) {
    if (combined.includes("vm") || combined.includes("virtual machine"))
      return "AZURE_VM";
    if (combined.includes("function")) return "AZURE_FUNCTIONS";
    if (combined.includes("sql")) return "AZURE_SQL";
    if (combined.includes("blob") || combined.includes("storage"))
      return "AZURE_BLOB";
    if (combined.includes("cosmos")) return "AZURE_COSMOS";
    if (combined.includes("api management")) return "AZURE_APP_GATEWAY";
    if (combined.includes("front door")) return "AZURE_FRONT_DOOR";
    if (combined.includes("service bus")) return "AZURE_SERVICE_BUS";
    if (combined.includes("aks") || combined.includes("kubernetes"))
      return "AZURE_AKS";
    return "AZURE_VM";
  }

  // Generic shapes
  if (
    combined.includes("database") ||
    combined.includes("cylinder") ||
    shapeLib.includes("cylinder")
  ) {
    return "DATABASE";
  }
  if (
    combined.includes("user") ||
    combined.includes("person") ||
    combined.includes("actor") ||
    shapeLib.includes("actor")
  ) {
    return "ACTOR";
  }
  if (
    combined.includes("external") ||
    combined.includes("cloud") ||
    shapeLib.includes("cloud")
  ) {
    return "EXTERNAL_ENTITY";
  }
  if (combined.includes("queue") || combined.includes("message")) {
    return "QUEUE";
  }
  if (
    combined.includes("cache") ||
    combined.includes("redis") ||
    combined.includes("memcache")
  ) {
    return "CACHE";
  }
  if (combined.includes("api") || combined.includes("gateway")) {
    return "API_GATEWAY";
  }
  if (combined.includes("load balancer") || combined.includes("lb")) {
    return "LOAD_BALANCER";
  }
  if (combined.includes("firewall") || combined.includes("waf")) {
    return "FIREWALL";
  }
  if (
    combined.includes("web") ||
    combined.includes("frontend") ||
    combined.includes("browser")
  ) {
    return "WEB_APP";
  }
  if (combined.includes("mobile")) {
    return "MOBILE_APP";
  }
  if (combined.includes("server") || combined.includes("service")) {
    return "MICROSERVICE";
  }
  if (combined.includes("process") || shapeLib.includes("flowchart")) {
    return "PROCESS";
  }

  return "MICROSERVICE";
}
