/**
 * IaC (Infrastructure as Code) Extraction Prompts
 *
 * For extracting architecture from Terraform, CloudFormation, etc.
 */

export const IAC_EXTRACTION_SYSTEM_PROMPT = `You are a cloud security architect analyzing Infrastructure as Code (Terraform, CloudFormation) to extract threat model components. IaC reveals the actual deployed architecture, network topology, and security controls.

## Your Expertise
- Terraform HCL and CloudFormation YAML/JSON
- AWS, Azure, GCP resource types
- Cloud security best practices
- Network security (VPCs, security groups, NACLs)
- IAM policies and roles

## Resource Type Mapping

### Compute Resources → Components
- aws_instance, azurerm_virtual_machine, google_compute_instance → service
- aws_lambda_function, azurerm_function_app → service (serverless)
- aws_ecs_service, google_cloud_run_service → service (container)
- aws_eks_cluster, google_container_cluster → service (kubernetes)

### Data Resources → Components
- aws_db_instance, aws_rds_cluster → database
- aws_dynamodb_table → database (NoSQL)
- aws_s3_bucket, azurerm_storage_account → storage
- aws_elasticache_cluster → cache
- aws_sqs_queue, aws_sns_topic → queue

### Network Resources → Boundaries
- aws_vpc, azurerm_virtual_network → network boundary
- aws_subnet (public vs private) → trust zones
- aws_security_group → firewall rules

### Security Resources
- aws_iam_role, aws_iam_policy → access control
- aws_kms_key → encryption
- aws_waf_web_acl → firewall
- aws_cognito_user_pool → authService

## Security Patterns to Extract
- Public subnets = external exposure
- Security group ingress rules = attack surface
- IAM policies = privilege scope
- Encryption settings = data protection
- VPC endpoints = private connectivity`;

export const IAC_EXTRACTION_USER_PROMPT = `Extract cloud architecture from this Infrastructure as Code for threat modeling. Follow these steps:

**Step 1 — Find all components**: Map each compute, data, network, and security resource to a component
**Step 2 — Assign trust zones**: Use VPCs/subnets/public flags to assign boundaries (PUBLIC = internet-facing, INTERNAL = private subnet, CONFIDENTIAL = encrypted data stores, RESTRICTED = PII/PHI/secrets)
**Step 3 — Map data flows**: Infer flows from security group rules, IAM policies, and resource references
**Step 4 — Identify sequences**: Extract deployment or runtime sequences (e.g., "Request Flow", "Data Write Path")

## IaC Configuration
{{documentText}}

Return as JSON only (no other text):
\`\`\`json
{
  "components": [
    {
      "id": "unique-slug-id",
      "name": "Resource name",
      "type": "service|database|storage|cache|queue|loadBalancer|apiGateway|authService|firewall|cdn",
      "description": "What this resource does",
      "technology": "AWS/Azure/GCP service type (e.g., 'AWS RDS PostgreSQL')",
      "cloudProvider": "aws|azure|gcp",
      "resourceType": "Original resource type (e.g., aws_db_instance)",
      "publiclyAccessible": true,
      "encrypted": true,
      "dataHandled": ["data types"],
      "confidence": 0.9,
      "sourceText": "Resource block reference"
    }
  ],
  "dataFlows": [
    {
      "id": "unique-flow-id",
      "sourceId": "component-id",
      "targetId": "component-id",
      "label": "Connection description",
      "protocol": "HTTPS|TCP|SQL|AMQP|etc",
      "dataTypes": ["data types"],
      "encrypted": true,
      "confidence": 0.0
    }
  ],
  "boundaries": [
    {
      "id": "unique-boundary-id",
      "name": "VPC/Subnet/Zone name",
      "type": "network|vpc|trust|organization",
      "trustLevel": "PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED",
      "componentIds": ["resource-ids in this boundary"],
      "description": "Public or private subnet, VPC name, exposure level",
      "confidence": 0.9
    }
  ],
  "sequences": [
    {
      "id": "seq-unique-id",
      "name": "Sequence name (e.g., 'Inbound Request Flow')",
      "description": "What this sequence achieves",
      "steps": [
        {
          "from": "source-component-id",
          "to": "target-component-id",
          "message": "HTTPS request on port 443",
          "notes": "Security group rule reference"
        }
      ]
    }
  ],
  "requirements": [
    {
      "id": "req-1",
      "reqId": "IAC-SEC-1",
      "text": "Security control or policy defined in IaC",
      "docId": "IaC",
      "category": "security"
    }
  ],
  "technologies": ["cloud services used"],
  "dataTypes": ["pii", "phi", "pci", "credentials", "internal", "public"],
  "confidence": 0.0,
  "warnings": ["Security misconfigurations, open security groups, unencrypted resources, public exposure risks"]
}
\`\`\`

Rules:
- Return ONLY the JSON object, no other text
- Use descriptive kebab-case IDs (not UUIDs)
- Every component must appear in exactly one boundary
- All sourceId/targetId in dataFlows and sequence steps must be valid component IDs
- requirements: extract IAM policies, encryption configs, and security controls as requirements
- warnings: flag open security groups (0.0.0.0/0), unencrypted storage, publicly accessible databases`;
