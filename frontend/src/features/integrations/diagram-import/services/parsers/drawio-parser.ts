import type { ComponentType } from "@/types/canvas";
import type {
  ParsedDiagram,
  ParsedShape,
  ParsedConnection,
  ParsedGroup,
} from "../../types";

export function parseDrawioXml(xml: string): ParsedDiagram {
  const shapes: ParsedShape[] = [];
  const connections: ParsedConnection[] = [];
  const groups: ParsedGroup[] = [];
  const parentMap = new Map<string, string>(); // childId -> parentId

  // Decode compressed content if present
  const decodedXml = decodeDrawioContent(xml);

  // Extract mxCell elements using regex
  const cellRegex = /<mxCell([^>]*)(?:\/>|>[\s\S]*?<\/mxCell>)/g;

  let match;
  while ((match = cellRegex.exec(decodedXml)) !== null) {
    const attrs = parseAttributes(match[1]);

    // Extract geometry from full cell content
    const geometry = extractGeometry(match[0]);

    const parentId = attrs["parent"];
    const id = attrs["id"];

    // Skip root cells (id=0 or id=1)
    if (id === "0" || id === "1") continue;

    // Check if this is a group/swimlane (has children)
    const isGroup =
      attrs["style"]?.includes("swimlane") ||
      attrs["style"]?.includes("group") ||
      attrs["style"]?.includes("container");

    if (attrs["vertex"] === "1") {
      if (isGroup) {
        groups.push({
          id,
          label: decodeHtmlEntities(attrs["value"] || ""),
          childIds: [],
          bounds: {
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
          },
        });
      } else {
        const label = decodeHtmlEntities(attrs["value"] || "");
        const style = attrs["style"] || "";
        shapes.push({
          id,
          label,
          type: inferTypeFromStyle(style),
          inferredType: mapToComponentType(style, label),
          position: { x: geometry.x, y: geometry.y },
          size: { width: geometry.width, height: geometry.height },
          style: parseStyleString(style),
        });
      }

      // Track parent relationship
      if (parentId && parentId !== "1") {
        parentMap.set(id, parentId);
      }
    } else if (attrs["edge"] === "1") {
      connections.push({
        id,
        sourceId: attrs["source"] || "",
        targetId: attrs["target"] || "",
        label: decodeHtmlEntities(attrs["value"] || ""),
      });
    }
  }

  // Assign children to groups
  for (const [childId, parentId] of parentMap) {
    const parentGroup = groups.find((g) => g.id === parentId);
    if (parentGroup) {
      parentGroup.childIds.push(childId);
    }
  }

  return {
    source: "drawio",
    shapes,
    connections,
    groups,
    metadata: { pageCount: 1 },
  };
}

function decodeDrawioContent(xml: string): string {
  // Check if content is compressed (base64 encoded)
  const compressedMatch = xml.match(/<diagram[^>]*>([^<]+)<\/diagram>/);
  if (compressedMatch) {
    try {
      // Compressed diagrams (base64 + deflate) are not decompressed; the XML is returned as-is.
      return xml;
    } catch {
      return xml;
    }
  }
  return xml;
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(attrString)) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }
  return attrs;
}

function extractGeometry(cellContent: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const geoMatch = cellContent.match(/<mxGeometry([^>]*)\/?>/);
  if (!geoMatch) return { x: 0, y: 0, width: 120, height: 60 };

  const attrs = parseAttributes(geoMatch[1]);
  return {
    x: parseFloat(attrs["x"] || "0"),
    y: parseFloat(attrs["y"] || "0"),
    width: parseFloat(attrs["width"] || "120"),
    height: parseFloat(attrs["height"] || "60"),
  };
}

function inferTypeFromStyle(style: string): string {
  if (style.includes("shape=cylinder")) return "database";
  if (style.includes("shape=cloud")) return "cloud";
  if (style.includes("shape=actor") || style.includes("shape=umlActor"))
    return "actor";
  if (style.includes("shape=hexagon")) return "service";
  if (style.includes("shape=mxgraph.aws")) return "aws";
  if (style.includes("shape=mxgraph.azure")) return "azure";
  if (style.includes("shape=mxgraph.gcp")) return "gcp";
  if (style.includes("rounded=1")) return "process";
  if (style.includes("rhombus")) return "decision";
  if (style.includes("ellipse")) return "ellipse";
  return "rectangle";
}

function mapToComponentType(style: string, label: string): ComponentType {
  const lowerLabel = label.toLowerCase();
  const lowerStyle = style.toLowerCase();

  // AWS shapes
  if (lowerStyle.includes("aws")) {
    if (lowerStyle.includes("ec2") || lowerLabel.includes("ec2"))
      return "AWS_EC2";
    if (lowerStyle.includes("lambda") || lowerLabel.includes("lambda"))
      return "AWS_LAMBDA";
    if (lowerStyle.includes("rds") || lowerLabel.includes("rds"))
      return "AWS_RDS";
    if (lowerStyle.includes("s3") || lowerLabel.includes("s3")) return "AWS_S3";
    if (lowerStyle.includes("dynamodb") || lowerLabel.includes("dynamo"))
      return "AWS_DYNAMODB";
    if (lowerStyle.includes("apigateway") || lowerLabel.includes("api gateway"))
      return "AWS_API_GATEWAY";
    if (lowerStyle.includes("cloudfront") || lowerLabel.includes("cloudfront"))
      return "AWS_CLOUDFRONT";
    if (lowerStyle.includes("elb") || lowerLabel.includes("load balancer"))
      return "AWS_ELB";
    if (lowerStyle.includes("sqs") || lowerLabel.includes("sqs"))
      return "AWS_SQS";
    if (lowerStyle.includes("sns") || lowerLabel.includes("sns"))
      return "AWS_SNS";
    if (lowerStyle.includes("cognito") || lowerLabel.includes("cognito"))
      return "AWS_COGNITO";
    if (lowerStyle.includes("kms") || lowerLabel.includes("kms"))
      return "AWS_KMS";
    if (lowerStyle.includes("waf") || lowerLabel.includes("waf"))
      return "AWS_WAF";
    if (lowerStyle.includes("vpc") || lowerLabel.includes("vpc"))
      return "AWS_VPC";
    if (lowerStyle.includes("ecs") || lowerLabel.includes("ecs"))
      return "AWS_ECS";
    if (lowerStyle.includes("eks") || lowerLabel.includes("eks"))
      return "AWS_EKS";
    return "AWS_EC2";
  }

  // Azure shapes
  if (lowerStyle.includes("azure")) {
    if (lowerLabel.includes("vm") || lowerLabel.includes("virtual machine"))
      return "AZURE_VM";
    if (lowerLabel.includes("function")) return "AZURE_FUNCTIONS";
    if (lowerLabel.includes("sql")) return "AZURE_SQL";
    if (lowerLabel.includes("blob") || lowerLabel.includes("storage"))
      return "AZURE_BLOB";
    if (lowerLabel.includes("cosmos")) return "AZURE_COSMOS";
    if (lowerLabel.includes("api management") || lowerLabel.includes("apim"))
      return "AZURE_APP_GATEWAY";
    if (lowerLabel.includes("front door")) return "AZURE_FRONT_DOOR";
    if (lowerLabel.includes("service bus")) return "AZURE_SERVICE_BUS";
    if (lowerLabel.includes("aks") || lowerLabel.includes("kubernetes"))
      return "AZURE_AKS";
    if (lowerLabel.includes("app service")) return "AZURE_APP_SERVICE";
    return "AZURE_VM";
  }

  // GCP shapes
  if (lowerStyle.includes("gcp") || lowerStyle.includes("google")) {
    if (lowerLabel.includes("compute")) return "GCP_COMPUTE";
    if (lowerLabel.includes("function")) return "GCP_FUNCTIONS";
    if (lowerLabel.includes("sql")) return "GCP_CLOUDSQL";
    if (lowerLabel.includes("storage")) return "GCP_STORAGE";
    if (lowerLabel.includes("pubsub") || lowerLabel.includes("pub/sub"))
      return "GCP_PUBSUB";
    if (lowerLabel.includes("bigquery")) return "GCP_BIGQUERY";
    if (lowerLabel.includes("gke") || lowerLabel.includes("kubernetes"))
      return "GCP_GKE";
    return "GCP_COMPUTE";
  }

  // Shape-based inference
  if (style.includes("shape=cylinder")) return "DATABASE";
  if (style.includes("shape=cloud")) return "EXTERNAL_ENTITY";
  if (style.includes("shape=actor") || style.includes("shape=umlActor"))
    return "ACTOR";

  // Label-based inference
  if (
    lowerLabel.includes("database") ||
    lowerLabel.includes("db") ||
    lowerLabel.includes("storage")
  )
    return "DATABASE";
  if (
    lowerLabel.includes("user") ||
    lowerLabel.includes("client") ||
    lowerLabel.includes("browser")
  )
    return "ACTOR";
  if (
    lowerLabel.includes("external") ||
    lowerLabel.includes("third party") ||
    lowerLabel.includes("3rd party")
  )
    return "EXTERNAL_ENTITY";
  if (
    lowerLabel.includes("queue") ||
    lowerLabel.includes("kafka") ||
    lowerLabel.includes("rabbitmq") ||
    lowerLabel.includes("sqs")
  )
    return "QUEUE";
  if (
    lowerLabel.includes("cache") ||
    lowerLabel.includes("redis") ||
    lowerLabel.includes("memcache")
  )
    return "CACHE";
  if (lowerLabel.includes("api") || lowerLabel.includes("gateway"))
    return "API_GATEWAY";
  if (
    lowerLabel.includes("load balancer") ||
    lowerLabel.includes("lb") ||
    lowerLabel.includes("nginx")
  )
    return "LOAD_BALANCER";
  if (lowerLabel.includes("firewall") || lowerLabel.includes("waf"))
    return "FIREWALL";
  if (
    lowerLabel.includes("cdn") ||
    lowerLabel.includes("cloudfront") ||
    lowerLabel.includes("cloudflare")
  )
    return "CDN";
  if (
    lowerLabel.includes("web") ||
    lowerLabel.includes("frontend") ||
    lowerLabel.includes("ui")
  )
    return "WEB_APP";
  if (
    lowerLabel.includes("mobile") ||
    lowerLabel.includes("ios") ||
    lowerLabel.includes("android")
  )
    return "MOBILE_APP";
  if (
    lowerLabel.includes("lambda") ||
    lowerLabel.includes("function") ||
    lowerLabel.includes("serverless")
  )
    return "SERVERLESS";
  if (
    lowerLabel.includes("container") ||
    lowerLabel.includes("docker") ||
    lowerLabel.includes("kubernetes")
  )
    return "CONTAINER";
  if (
    lowerLabel.includes("service") ||
    lowerLabel.includes("server") ||
    lowerLabel.includes("backend")
  )
    return "MICROSERVICE";

  return "MICROSERVICE";
}

function parseStyleString(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  style.split(";").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) result[key] = value;
  });
  return result;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, ""); // Strip any remaining HTML tags
}
