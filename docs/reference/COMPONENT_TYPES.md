# Component Types Reference

This document lists all available component types that can be used in threat model diagrams.

## Overview

ThreatForge supports **282 component types** organized into categories:

- [DFD Elements](#dfd-elements)
- [Application Layer](#application-layer)
- [Data Layer](#data-layer)
- [Networking](#networking)
- [Security](#security)
- [Infrastructure](#infrastructure)
- [AWS Services](#aws-services)
- [GCP Services](#gcp-services)
- [Azure Services](#azure-services)
- [Blockchain & Web3](#blockchain--web3)

---

## DFD Elements

Standard Data Flow Diagram notation elements.

| Type | Icon | Description |
|------|------|-------------|
| `ACTOR` | 👤 | Human user or external entity |
| `PROCESS` | ⚙️ | Processing/transformation node (circle) |
| `DATA_STORE` | 📁 | Data storage (parallel lines) |
| `DATA_FLOW` | ➡️ | Data movement between nodes |
| `TRUST_BOUNDARY` | 🔲 | Security zone boundary |

---

## Application Layer

Components representing application-level services.

### Web & Mobile

| Type | Description |
|------|-------------|
| `WEB_APPLICATION` | Web-based application frontend |
| `MOBILE_APP` | Mobile application (iOS/Android) |
| `DESKTOP_APP` | Desktop application |

### APIs & Services

| Type | Description |
|------|-------------|
| `API` | Generic API endpoint (REST, SOAP, etc.) |
| `GRAPHQL_API` | GraphQL API service |
| `GRPC_SERVICE` | gRPC service |
| `WEBSOCKET_SERVER` | WebSocket server |

### Microservices

| Type | Description |
|------|-------------|
| `SERVICE` | Generic service |
| `MICROSERVICE` | Microservice component |
| `FUNCTION` | Serverless function (use `AWS_LAMBDA`, `GCP_FUNCTIONS`, or `AZURE_FUNCTIONS` for specific clouds) |
| `WORKER` | Background worker/job processor |
| `SCHEDULER` | Job scheduler |

### Processing

| Type | Description |
|------|-------------|
| `PROCESS` | Processing component |
| `BATCH_PROCESSOR` | Batch processing job |
| `STREAM_PROCESSOR` | Stream processing pipeline |
| `ETL_PIPELINE` | Extract-Transform-Load pipeline |
| `ML_MODEL` | Machine learning model |
| `AI_SERVICE` | AI/ML service endpoint |

---

## Data Layer

Components for data storage and management.

### Databases

| Type | Description |
|------|-------------|
| `DATABASE` | Generic database |
| `RELATIONAL_DB` | Relational database (SQL) |
| `NOSQL_DB` | NoSQL database |
| `DOCUMENT_DB` | Document database (MongoDB) |
| `KEY_VALUE_STORE` | Key-value store |
| `GRAPH_DB` | Graph database |
| `TIME_SERIES_DB` | Time series database |
| `SEARCH_ENGINE` | Search engine (Elasticsearch) |

### Specific Databases

| Type | Description |
|------|-------------|
| `POSTGRESQL` | PostgreSQL database |
| `MYSQL` | MySQL database |
| `MONGODB` | MongoDB database |
| `REDIS` | Redis in-memory store |
| `ELASTICSEARCH` | Elasticsearch cluster |
| `DYNAMODB` | AWS DynamoDB |
| `CASSANDRA` | Apache Cassandra |

### Storage

| Type | Description |
|------|-------------|
| `FILE_STORAGE` | File storage system |
| `OBJECT_STORAGE` | Object storage (S3-compatible) |
| `BLOB_STORAGE` | Blob storage |
| `BLOCK_STORAGE` | Block storage volume |
| `NAS` | Network Attached Storage |
| `DATA_LAKE` | Data lake storage |
| `DATA_WAREHOUSE` | Data warehouse |

### Caching & Queues

| Type | Description |
|------|-------------|
| `CACHE` | Generic cache |
| `CDN_CACHE` | CDN cache layer |
| `SESSION_STORE` | Session storage |
| `QUEUE` | Message queue |
| `MESSAGE_BROKER` | Message broker |
| `EVENT_BUS` | Event bus/stream |
| `PUB_SUB` | Pub/sub messaging |

### Specific Queue Systems

| Type | Description |
|------|-------------|
| `KAFKA` | Apache Kafka |
| `RABBITMQ` | RabbitMQ |
| `SQS` | AWS SQS |
| `SNS` | AWS SNS |
| `KINESIS` | AWS Kinesis |

---

## Networking

Network infrastructure components.

### Load Balancing & Routing

| Type | Description |
|------|-------------|
| `LOAD_BALANCER` | Load balancer |
| `ALB` | Application Load Balancer |
| `NLB` | Network Load Balancer |
| `REVERSE_PROXY` | Reverse proxy server |
| `API_GATEWAY` | API Gateway |
| `SERVICE_MESH` | Service mesh (Istio, Linkerd) |

### Network Components

| Type | Description |
|------|-------------|
| `DNS` | DNS server/service |
| `VPC` | Virtual Private Cloud |
| `SUBNET` | Network subnet |
| `NAT_GATEWAY` | NAT Gateway |
| `INTERNET_GATEWAY` | Internet Gateway |
| `VPN_GATEWAY` | VPN Gateway |
| `DIRECT_CONNECT` | Direct Connect |

### Security Appliances

| Type | Description |
|------|-------------|
| `FIREWALL` | Network firewall |
| `WAF` | Web Application Firewall |
| `IDS` | Intrusion Detection System |
| `IPS` | Intrusion Prevention System |
| `DLP` | Data Loss Prevention |
| `SIEM` | Security Information & Event Management |

---

## Security

Security and identity components.

### Identity & Access

| Type | Description |
|------|-------------|
| `IAM` | Identity and Access Management |
| `AUTH_SERVICE` | Authentication service |
| `SSO` | Single Sign-On service |
| `OAUTH_PROVIDER` | OAuth provider |
| `SAML_PROVIDER` | SAML identity provider |
| `MFA_SERVICE` | Multi-factor authentication |
| `DIRECTORY_SERVICE` | Directory service (LDAP, AD) |

### Secrets & Keys

| Type | Description |
|------|-------------|
| `KMS` | Key Management Service |
| `SECRETS_MANAGER` | Secrets manager |
| `HSM` | Hardware Security Module |
| `VAULT` | HashiCorp Vault |
| `CERTIFICATE_AUTHORITY` | Certificate Authority |

### Security Services

| Type | Description |
|------|-------------|
| `SECURITY_SCANNER` | Security scanner |
| `VULNERABILITY_SCANNER` | Vulnerability scanner |
| `PENETRATION_TESTING` | Pen testing service |
| `THREAT_INTELLIGENCE` | Threat intelligence feed |
| `SECURITY_MONITORING` | Security monitoring |

---

## Infrastructure

Infrastructure and platform components.

### Compute

| Type | Description |
|------|-------------|
| `SERVER` | Physical/virtual server |
| `VM` | Virtual machine |
| `EC2_INSTANCE` | AWS EC2 instance |
| `CONTAINER` | Container instance |
| `CONTAINER_REGISTRY` | Container image registry |
| `SERVERLESS_PLATFORM` | Serverless platform |

### Orchestration

| Type | Description |
|------|-------------|
| `KUBERNETES` | Kubernetes cluster |
| `EKS` | Amazon EKS |
| `ECS` | Amazon ECS |
| `DOCKER_SWARM` | Docker Swarm |
| `NOMAD` | HashiCorp Nomad |

### CI/CD & DevOps

| Type | Description |
|------|-------------|
| `CI_CD_PIPELINE` | CI/CD pipeline |
| `BUILD_SERVER` | Build server |
| `ARTIFACT_REPOSITORY` | Artifact repository |
| `CONFIG_SERVER` | Configuration server |
| `SERVICE_DISCOVERY` | Service discovery |

### Monitoring & Logging

| Type | Description |
|------|-------------|
| `MONITORING` | Monitoring system |
| `LOGGING` | Logging system |
| `METRICS` | Metrics collection |
| `TRACING` | Distributed tracing |
| `ALERTING` | Alerting system |
| `APM` | Application Performance Monitoring |

---

## AWS Services

Comprehensive AWS service components.

### Compute

| Type | Description |
|------|-------------|
| `AWS_EC2` | EC2 Compute |
| `AWS_LAMBDA` | Lambda Functions |
| `AWS_ECS` | Elastic Container Service |
| `AWS_EKS` | Elastic Kubernetes Service |
| `AWS_FARGATE` | Fargate Serverless Containers |
| `AWS_BATCH` | Batch Processing |
| `AWS_LIGHTSAIL` | Lightsail |
| `AWS_ELASTIC_BEANSTALK` | Elastic Beanstalk |

### Storage

| Type | Description |
|------|-------------|
| `AWS_S3` | S3 Object Storage |
| `AWS_EBS` | Elastic Block Store |
| `AWS_EFS` | Elastic File System |
| `AWS_GLACIER` | Glacier Archive |
| `AWS_STORAGE_GATEWAY` | Storage Gateway |
| `AWS_FSX` | FSx File Systems |

### Database

| Type | Description |
|------|-------------|
| `AWS_RDS` | Relational Database Service |
| `AWS_AURORA` | Aurora Database |
| `AWS_DYNAMODB` | DynamoDB |
| `AWS_ELASTICACHE` | ElastiCache |
| `AWS_REDSHIFT` | Redshift Data Warehouse |
| `AWS_NEPTUNE` | Neptune Graph Database |
| `AWS_DOCUMENTDB` | DocumentDB |
| `AWS_TIMESTREAM` | Timestream |
| `AWS_QLDB` | Quantum Ledger Database |

### Networking

| Type | Description |
|------|-------------|
| `AWS_VPC` | Virtual Private Cloud |
| `AWS_ALB` | Application Load Balancer |
| `AWS_NLB` | Network Load Balancer |
| `AWS_CLOUDFRONT` | CloudFront CDN |
| `AWS_ROUTE53` | Route 53 DNS |
| `AWS_API_GATEWAY` | API Gateway |
| `AWS_DIRECT_CONNECT` | Direct Connect |
| `AWS_TRANSIT_GATEWAY` | Transit Gateway |
| `AWS_GLOBAL_ACCELERATOR` | Global Accelerator |

### Security

| Type | Description |
|------|-------------|
| `AWS_IAM` | Identity and Access Management |
| `AWS_COGNITO` | Cognito User Pools |
| `AWS_KMS` | Key Management Service |
| `AWS_SECRETS_MANAGER` | Secrets Manager |
| `AWS_WAF` | Web Application Firewall |
| `AWS_SHIELD` | Shield DDoS Protection |
| `AWS_GUARDDUTY` | GuardDuty Threat Detection |
| `AWS_INSPECTOR` | Inspector Vulnerability Scanning |
| `AWS_MACIE` | Macie Data Discovery |
| `AWS_SECURITY_HUB` | Security Hub |
| `AWS_ACM` | Certificate Manager |

### Messaging & Integration

| Type | Description |
|------|-------------|
| `AWS_SQS` | Simple Queue Service |
| `AWS_SNS` | Simple Notification Service |
| `AWS_KINESIS` | Kinesis Data Streams |
| `AWS_EVENTBRIDGE` | EventBridge |
| `AWS_STEP_FUNCTIONS` | Step Functions |
| `AWS_MQ` | Amazon MQ |
| `AWS_SES` | Simple Email Service |

### Analytics & ML

| Type | Description |
|------|-------------|
| `AWS_ATHENA` | Athena SQL Analytics |
| `AWS_EMR` | Elastic MapReduce |
| `AWS_GLUE` | Glue ETL |
| `AWS_KINESIS_ANALYTICS` | Kinesis Analytics |
| `AWS_QUICKSIGHT` | QuickSight BI |
| `AWS_SAGEMAKER` | SageMaker ML |
| `AWS_COMPREHEND` | Comprehend NLP |
| `AWS_REKOGNITION` | Rekognition Computer Vision |
| `AWS_BEDROCK` | Bedrock Foundation Models |

### Management & Monitoring

| Type | Description |
|------|-------------|
| `AWS_CLOUDWATCH` | CloudWatch Monitoring |
| `AWS_CLOUDTRAIL` | CloudTrail Audit |
| `AWS_CONFIG` | Config Compliance |
| `AWS_SYSTEMS_MANAGER` | Systems Manager |
| `AWS_ORGANIZATIONS` | Organizations |
| `AWS_CONTROL_TOWER` | Control Tower |
| `AWS_SERVICE_CATALOG` | Service Catalog |

### Developer Tools

| Type | Description |
|------|-------------|
| `AWS_CODECOMMIT` | CodeCommit Git |
| `AWS_CODEBUILD` | CodeBuild CI |
| `AWS_CODEDEPLOY` | CodeDeploy CD |
| `AWS_CODEPIPELINE` | CodePipeline |
| `AWS_CLOUD9` | Cloud9 IDE |
| `AWS_CODEARTIFACT` | CodeArtifact Repository |

---

## External Entities

Components representing external systems and users.

| Type | Description |
|------|-------------|
| `EXTERNAL_USER` | External human user |
| `INTERNAL_USER` | Internal employee/user |
| `EXTERNAL_SYSTEM` | Third-party system |
| `PARTNER_API` | Partner API integration |
| `VENDOR_SERVICE` | Vendor/SaaS service |
| `GOVERNMENT_SYSTEM` | Government system |
| `PAYMENT_PROCESSOR` | Payment gateway |
| `EMAIL_PROVIDER` | Email service provider |
| `SMS_PROVIDER` | SMS service provider |

---

## Custom Components

Organizations can create custom component templates with:

- Custom names and descriptions
- Custom icons (Lucide icons or emoji)
- Custom colors
- Default properties
- Suggested threats
- Tags for categorization

See [Component Templates](../FEATURES.md#component-templates) for details on creating custom components.

---

## GCP Services

Comprehensive Google Cloud Platform service components.

### Compute

| Type | Description |
|------|-------------|
| `GCP_COMPUTE` | Compute Engine VMs |
| `GCP_FUNCTIONS` | Cloud Functions |
| `GCP_GKE` | Google Kubernetes Engine |
| `GCP_CLOUD_RUN` | Cloud Run Serverless |
| `GCP_APP_ENGINE` | App Engine |
| `GCP_ANTHOS` | Anthos Hybrid Platform |
| `GCP_BATCH` | Batch Processing |

### Storage

| Type | Description |
|------|-------------|
| `GCP_STORAGE` | Cloud Storage |
| `GCP_PERSISTENT_DISK` | Persistent Disk |
| `GCP_FILESTORE` | Filestore NFS |
| `GCP_ARCHIVE_STORAGE` | Archive Storage |

### Database

| Type | Description |
|------|-------------|
| `GCP_CLOUDSQL` | Cloud SQL |
| `GCP_FIRESTORE` | Firestore NoSQL |
| `GCP_BIGTABLE` | Bigtable |
| `GCP_SPANNER` | Cloud Spanner |
| `GCP_MEMORYSTORE` | Memorystore Redis/Memcached |
| `GCP_DATASTORE` | Datastore |
| `GCP_ALLOYDB` | AlloyDB PostgreSQL |

### Networking

| Type | Description |
|------|-------------|
| `GCP_VPC` | Virtual Private Cloud |
| `GCP_CLOUD_CDN` | Cloud CDN |
| `GCP_CLOUD_DNS` | Cloud DNS |
| `GCP_LOAD_BALANCING` | Cloud Load Balancing |
| `GCP_CLOUD_NAT` | Cloud NAT |
| `GCP_CLOUD_ARMOR` | Cloud Armor Security |
| `GCP_CLOUD_INTERCONNECT` | Cloud Interconnect |
| `GCP_TRAFFIC_DIRECTOR` | Traffic Director |

### Security

| Type | Description |
|------|-------------|
| `GCP_IAM` | Identity and Access Management |
| `GCP_KMS` | Cloud Key Management |
| `GCP_SECRET_MANAGER` | Secret Manager |
| `GCP_IDENTITY_PLATFORM` | Identity Platform |
| `GCP_SECURITY_COMMAND_CENTER` | Security Command Center |
| `GCP_CERTIFICATE_MANAGER` | Certificate Manager |

### Messaging

| Type | Description |
|------|-------------|
| `GCP_PUBSUB` | Pub/Sub Messaging |
| `GCP_CLOUD_TASKS` | Cloud Tasks |
| `GCP_EVENTARC` | Eventarc |
| `GCP_WORKFLOWS` | Workflows |

### AI/ML

| Type | Description |
|------|-------------|
| `GCP_VERTEX_AI` | Vertex AI Platform |
| `GCP_AUTOML` | AutoML |
| `GCP_VISION_AI` | Vision AI |
| `GCP_NATURAL_LANGUAGE` | Natural Language API |
| `GCP_SPEECH_TO_TEXT` | Speech-to-Text |
| `GCP_TRANSLATION` | Translation API |
| `GCP_DIALOGFLOW` | Dialogflow |
| `GCP_DOCUMENT_AI` | Document AI |

### Analytics

| Type | Description |
|------|-------------|
| `GCP_BIGQUERY` | BigQuery Data Warehouse |
| `GCP_DATAFLOW` | Dataflow |
| `GCP_DATAPROC` | Dataproc (Spark/Hadoop) |
| `GCP_COMPOSER` | Cloud Composer (Airflow) |
| `GCP_DATA_FUSION` | Data Fusion |
| `GCP_LOOKER` | Looker BI |
| `GCP_DATAPLEX` | Dataplex |

### DevOps

| Type | Description |
|------|-------------|
| `GCP_CLOUD_BUILD` | Cloud Build CI/CD |
| `GCP_ARTIFACT_REGISTRY` | Artifact Registry |
| `GCP_CLOUD_DEPLOY` | Cloud Deploy |
| `GCP_SOURCE_REPOS` | Cloud Source Repositories |

### Management & Monitoring

| Type | Description |
|------|-------------|
| `GCP_CLOUD_LOGGING` | Cloud Logging |
| `GCP_CLOUD_MONITORING` | Cloud Monitoring |
| `GCP_CLOUD_TRACE` | Cloud Trace |
| `GCP_ERROR_REPORTING` | Error Reporting |

---

## Azure Services

Comprehensive Microsoft Azure service components.

### Compute

| Type | Description |
|------|-------------|
| `AZURE_VM` | Virtual Machines |
| `AZURE_FUNCTIONS` | Azure Functions |
| `AZURE_AKS` | Azure Kubernetes Service |
| `AZURE_CONTAINER_INSTANCES` | Container Instances |
| `AZURE_CONTAINER_APPS` | Container Apps |
| `AZURE_APP_SERVICE` | App Service |
| `AZURE_BATCH` | Batch |
| `AZURE_VMSS` | VM Scale Sets |

### Storage

| Type | Description |
|------|-------------|
| `AZURE_BLOB` | Blob Storage |
| `AZURE_FILES` | Azure Files |
| `AZURE_DISK` | Managed Disks |
| `AZURE_DATA_LAKE` | Data Lake Storage |
| `AZURE_ARCHIVE` | Archive Storage |
| `AZURE_NETAPP` | NetApp Files |

### Database

| Type | Description |
|------|-------------|
| `AZURE_SQL` | Azure SQL Database |
| `AZURE_COSMOS` | Cosmos DB |
| `AZURE_POSTGRESQL` | PostgreSQL |
| `AZURE_MYSQL` | MySQL |
| `AZURE_MARIADB` | MariaDB |
| `AZURE_CACHE_REDIS` | Cache for Redis |
| `AZURE_SYNAPSE` | Synapse Analytics |
| `AZURE_DATA_EXPLORER` | Data Explorer |

### Networking

| Type | Description |
|------|-------------|
| `AZURE_VNET` | Virtual Network |
| `AZURE_CDN` | Content Delivery Network |
| `AZURE_DNS` | Azure DNS |
| `AZURE_LOAD_BALANCER` | Load Balancer |
| `AZURE_APP_GATEWAY` | Application Gateway |
| `AZURE_FRONT_DOOR` | Front Door |
| `AZURE_TRAFFIC_MANAGER` | Traffic Manager |
| `AZURE_FIREWALL` | Azure Firewall |
| `AZURE_EXPRESSROUTE` | ExpressRoute |
| `AZURE_VPN_GATEWAY` | VPN Gateway |
| `AZURE_BASTION` | Azure Bastion |
| `AZURE_PRIVATE_LINK` | Private Link |

### Security

| Type | Description |
|------|-------------|
| `AZURE_AD` | Microsoft Entra ID (Azure AD) |
| `AZURE_AD_B2C` | Azure AD B2C |
| `AZURE_KEY_VAULT` | Key Vault |
| `AZURE_DEFENDER` | Microsoft Defender |
| `AZURE_SENTINEL` | Microsoft Sentinel SIEM |
| `AZURE_WAF` | Web Application Firewall |
| `AZURE_DDOS_PROTECTION` | DDoS Protection |

### Messaging

| Type | Description |
|------|-------------|
| `AZURE_SERVICE_BUS` | Service Bus |
| `AZURE_EVENT_HUB` | Event Hubs |
| `AZURE_EVENT_GRID` | Event Grid |
| `AZURE_NOTIFICATION_HUB` | Notification Hubs |
| `AZURE_QUEUE_STORAGE` | Queue Storage |

### AI/ML

| Type | Description |
|------|-------------|
| `AZURE_ML` | Azure Machine Learning |
| `AZURE_OPENAI` | Azure OpenAI Service |
| `AZURE_COGNITIVE_SERVICES` | Cognitive Services |
| `AZURE_BOT_SERVICE` | Bot Service |
| `AZURE_FORM_RECOGNIZER` | Form Recognizer |
| `AZURE_TRANSLATOR` | Translator |
| `AZURE_SPEECH` | Speech Services |

### Analytics

| Type | Description |
|------|-------------|
| `AZURE_DATABRICKS` | Databricks |
| `AZURE_DATA_FACTORY` | Data Factory |
| `AZURE_STREAM_ANALYTICS` | Stream Analytics |
| `AZURE_PURVIEW` | Microsoft Purview |
| `AZURE_POWER_BI` | Power BI |
| `AZURE_ANALYSIS_SERVICES` | Analysis Services |

### DevOps

| Type | Description |
|------|-------------|
| `AZURE_DEVOPS` | Azure DevOps |
| `AZURE_REPOS` | Azure Repos |
| `AZURE_PIPELINES` | Azure Pipelines |
| `AZURE_ARTIFACTS` | Azure Artifacts |
| `AZURE_CONTAINER_REGISTRY` | Container Registry |

### Management & Monitoring

| Type | Description |
|------|-------------|
| `AZURE_MONITOR` | Azure Monitor |
| `AZURE_LOG_ANALYTICS` | Log Analytics |
| `AZURE_APPLICATION_INSIGHTS` | Application Insights |
| `AZURE_AUTOMATION` | Azure Automation |
| `AZURE_LOGIC_APPS` | Logic Apps |

---

## Blockchain & Web3

Components for blockchain and decentralized applications.

| Type | Description |
|------|-------------|
| `SMART_CONTRACT` | Smart Contract |
| `WALLET` | Cryptocurrency Wallet |
| `BLOCKCHAIN_NODE` | Blockchain Node |
| `ORACLE` | Blockchain Oracle (Chainlink, etc.) |
| `IPFS` | IPFS Distributed Storage |
