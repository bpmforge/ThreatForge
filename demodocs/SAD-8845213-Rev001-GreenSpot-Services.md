# UNRELEASED COPY
PAGE 1 OF 14

**DOCUMENT IDENTIFICATION:**
SW82345 AgriTech GreenSpot Services
Software Architecture Document
SAD-8845213
Rev: Rev001

---

## Table of Contents
1. **SCOPE**
   1.1 References
   1.2 Acronyms & Definitions
2. **SOFTWARE DESCRIPTION**
   2.1 Software Operation
       2.1.1 Role of the software as it relates to the intended use of the system
       2.1.2 Intended users of the software
       2.1.3 Intended user population (facilities)
       2.1.4 Analysis methodology (if any)
       2.1.5 AI/ML models, methods and framework used to train the software (if any)
   2.2 Software Specifics
       2.2.1 Hardware and software platforms
       2.2.2 OTS (Off-the shelf) Software
       2.2.3 Final release version of the software component
   2.3 Software Inputs and Outputs
       2.3.1 Inputs, outputs, and their format
       2.3.2 Software Workflow and dataflow
       2.3.3 Interoperable system design
   2.4 Feature List
   2.5 Software and Infrastructure
3. **SOFTWARE ARCHITECTURE**
   3.1 Software Integration Architecture
   3.2 Software Process Workflow
   3.3 Software of Unknown Provenance (SOUP)/ Off-The-Shelf Software (OTS)
       3.3.1 Direct SOUP/OTS List
       3.3.2 External SOUP/OTS List
4. **Attachments**

---

## 1. SCOPE
This document describes the software architecture for SW82345 AgriTech GreenSpot Services (“GreenSpot Services”), including its components, data flows, and sequence diagrams, ensuring compliance with commercial agricultural telemetry standards.

### 1.1 References

| Document Number | Document Title |
| :--- | :--- |
| CORP-SOP-9981 | Software Development Life Cycle Procedure (AgriTech) |
| SRS-9876543 | SW82345 GreenSpot Services Software Requirements Specification |
| SW77123 | GreenSpot Telemetry Ingestion Services |
| SW88190 | AgriTech Environmental Analytics Platform (EAP) Pipeline |
| SW99484 | GreenSpot Yield Insight Services |
| SW99518 | AgriTech SensorBridge API |

### 1.2 Acronyms & Definitions
- **AWS:** Amazon Web Services
- **EAP:** Environmental Analytics Platform
- **TIGR:** Time In Optimal Growth Range
- **Zone:** A logically grouped set of environmental sensors representing a specific area within a greenhouse facility.
- **SOUP:** Software of Unknown Provenance

## 2. SOFTWARE DESCRIPTION

### 2.1 Software Operation

#### 2.1.1 Role of the software as it relates to the intended use of the system
GreenSpot Services acts as the central intelligence hub for smart greenhouse operations. It ingests continuous data streams (Soil Moisture, Ambient Temperature, Humidity, Light Intensity) from edge sensors to provide real-time calculations regarding environmental stability, optimal growth conditions, and anomaly detection.

#### 2.1.2 Intended users of the software
- Greenhouse Operations Managers
- Commercial Agronomists
- Automated Climate Control Systems (via API integration)

#### 2.1.3 Intended user population (facilities)
Commercial-scale agricultural facilities specializing in high-yield, sensitive crop cultivation requiring strict microclimate management.

#### 2.1.4 Analysis methodology (if any)
The software employs statistical time-series analysis to calculate the "Time In Optimal Growth Range" (TIGR) over configurable 24-hour, 7-day, and 30-day windows.

#### 2.1.5 AI/ML models, methods and framework used to train the software (if any)
A Random Forest anomaly detection model is utilized to identify non-standard microclimate deviations (e.g., sudden humidity drops indicative of HVAC failure or vent malfunction). Models are trained on anonymized historical climate data using the TensorFlow framework.

### 2.2 Software Specifics

#### 2.2.1 Hardware and software platforms
- **Platform:** Cloud-native microservices architecture.
- **Environment:** Managed Kubernetes clusters (EKS) on Amazon Web Services.
- **Languages:** Go (Ingestion), Python (Analytics Engine), React (Dashboard).

#### 2.2.2 OTS (Off-the shelf) Software
- PostgreSQL (Relational Data Storage)
- Apache Kafka (Message Broker for telemetry streaming)
- Redis (In-memory caching layer)

#### 2.2.3 Final release version of the software component
v1.0.0 (Release Candidate pending UAT)

### 2.3 Software Inputs and Outputs

#### 2.3.1 Inputs, outputs, and their format
- **Inputs:** JSON payloads via HTTPS POST containing `sensor_id`, `timestamp`, `moisture_level`, `temperature_c`, `humidity_pct`.
- **Outputs:** REST API responses returning aggregated JSON objects (e.g., Daily TIGR summary, Active Anomalies). Event streams pushed via WebSockets to the operations dashboard.

#### 2.3.2 Software Workflow and dataflow
Data flows from the physical greenhouse sensor array into the `GreenSpot Telemetry Ingestion Services`. Validated data is published to a Kafka topic. The `EAP Pipeline` subscribes to this topic, persisting raw data to PostgreSQL and calculating real-time aggregates (like TIGR) which are cached in Redis. The frontend dashboard fetches these aggregates via the `AgriTech SensorBridge API`.

#### 2.3.3 Interoperable system design
The system exposes standardized Webhooks to allow bidirectional communication with automated irrigation and ventilation controllers (e.g., Priva, Argus).

### 2.4 Feature List
- Continuous Sensor Telemetry Ingestion
- Real-time "Time In Optimal Growth Range" (TIGR) Calculation
- 24/7 Microclimate Anomaly Pattern Detection
- Automated Alerting and Webhook Execution
- Historical Yield Correlation Reporting

### 2.5 Software and Infrastructure
The backend is designed for horizontal scalability. Auto-scaling groups are configured to spin up additional ingestion pods if the Kafka queue lag exceeds 500ms. Infrastructure as Code (IaC) is maintained via Terraform.

## 3. SOFTWARE ARCHITECTURE

### 3.1 Software Integration Architecture
(Refer to PROJ-8821 for the detailed C4 model diagrams outlining container and component interactions.)
The architecture relies on an Event-Driven design pattern. The core components are loosely coupled, communicating primarily via Kafka message buses to ensure high availability even if individual analytics modules fail or are updated.

### 3.2 Software Process Workflow
1. Sensor device transmits payload.
2. API Gateway authenticates sensor certificate.
3. Ingestion service validates JSON schema.
4. Payload placed on 'raw-telemetry' topic.
5. TIGR Calculator service processes payload; updates Redis cache.
6. Anomaly Detection service scores payload; if anomaly detected, places event on 'alerts' topic.
7. Notification service consumes 'alerts' topic and dispatches SMS/Webhooks.

### 3.3 Software of Unknown Provenance (SOUP)/ Off-The-Shelf Software (OTS)

#### 3.3.1 Direct SOUP/OTS List
- `gorilla/mux` (Go HTTP router)
- `scikit-learn` (Python ML library)
- `axios` (JavaScript HTTP client)

#### 3.3.2 External SOUP/OTS List
- AWS Managed PostgreSQL (RDS)
- AWS Managed Streaming for Kafka (MSK)
- Datadog (Application Performance Monitoring)

## 4. Attachments
- Appendix A: Full API Contract Specification (Swagger/OpenAPI 3.0)
- Appendix B: Infrastructure as Code (Terraform) Snippets
