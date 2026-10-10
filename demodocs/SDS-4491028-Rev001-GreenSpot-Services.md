# UNRELEASED COPY
PAGE 1 OF 20

**DOCUMENT IDENTIFICATION:**
SW82345 AgriTech GreenSpot Services
Software Design Specification
SDS-4491028
Rev: Rev001

---

## TABLE OF CONTENTS
1. **Purpose**
2. **Scope**
3. **REFERENCES**
4. **DEFINITIONS**
5. **OVERVIEW**
6. **DESIGN**
   6.1 Software Components
   6.2 Software Integration
   6.3 Service Configuration
   6.4 Key Features and Functions
       6.4.1 Availability and Data Sufficiency
       6.4.2 Average Soil Moisture & Temp Statistics
       6.4.3 Sensor Usage Statistics
       6.4.4 Time in Optimal Growth Range (TIGR) Statistics
       6.4.5 Microclimate Anomaly Pattern Detection
   6.5 Time in Optimal Growth Range Calculations
       6.5.1 Defining Discrete Ranges from Given Thresholds
       6.5.2 Algorithm to Group Sensor Data Points
       6.5.3 Time in Range Display Rounding
   6.6 Microclimate Anomaly Patterns Algorithm
       6.6.1 Required Inputs
       6.6.2 Step 1: Separate the Sensor Data into Low/High Moisture/Temp Groups
       6.6.3 Step 2: Create Modal Points and Modal Days
       6.6.4 Step 3: Populate Modal Days
       6.6.5 Step 4: Find the Number of Contributing Days
       6.6.6 Step 5: Make Double Periods
       6.6.7 Step 6: Identify Low and High Start Points
       6.6.8 Step 7: Find Low and High Pattern Instances
       6.6.9 Step 8: Separate Significant Matches into Daytime and Nighttime Categories
       6.6.10 Step 9: Sort Matches by Volume
   6.7 Security and Data Governance
7. **ATTACHMENTS**

---

## 1. Purpose
The purpose of this document is to present the detailed software design specifications for SW82345 AgriTech GreenSpot Services (“GreenSpot Services”), particularly focusing on the core analytical algorithms responsible for determining environmental stability in commercial greenhouse applications.

## 2. Scope
This document applies strictly to the backend processing logic, algorithms, and data structures of GreenSpot Services (SW82345). It provides a low-level description of the software features, mathematical models for TIGR, pattern recognition heuristics, and internal interfaces.

## 3. REFERENCES

| Document No. | Description |
| :--- | :--- |
| ISO 14001:2015 | Environmental Management Systems - Requirements |
| CORP-SOP-9981 | Software Development Life Cycle Procedure (AgriTech) |
| CORP-SOP-9950 | Algorithm Validation Protocol |
| SRS-9876543 | SW82345 GreenSpot Services Software Requirements Specification |
| SAD-8845213 | SW82345 GreenSpot Services Software Architecture Document |

## 4. DEFINITIONS
- **TIGR:** Time In Optimal Growth Range. The primary metric indicating the percentage of a given time period where environmental conditions were favorable for crop development.
- **Sensor Data Point (SDP):** A single time-stamped reading containing temperature, humidity, and soil moisture values from a specific sensor.
- **Modal Day:** A mathematical construct used in pattern recognition representing a synthesized "average" 24-hour period based on historical SDPs.

## 5. OVERVIEW
GreenSpot Services ingests, processes, and analyzes high-frequency environmental telemetry. The core value of the system lies in its ability to translate raw Sensor Data Points (SDPs) into actionable insights: Average Statistics, TIGR, and Microclimate Anomaly Patterns. This document details the specific software design and algorithmic steps required to generate these insights reliably and accurately at scale.

## 6. DESIGN

### 6.1 Software Components
The system is comprised of three primary calculation engines (microservices):
- The `Averaging Engine`: Computes rolling means for temperature and moisture.
- The `TIGR Engine`: Evaluates SDPs against configured threshold bands.
- The `Pattern Recognition Engine`: Executes the complex anomaly detection algorithm.

### 6.2 Software Integration
These calculation engines are integrated via an Apache Kafka event bus. The `Telemetry Ingestion Service` publishes sanitized SDPs to a shared topic. Each engine consumes this topic independently, performs its specific calculations, and writes the resulting insights (TIGR, Averages, Patterns) directly to a highly available Redis cluster and a permanent PostgreSQL store.

### 6.3 Service Configuration
Service parameters (e.g., specific optimal growth thresholds for different crop types like tomatoes vs. leafy greens) are managed via a centralized Configuration Service using etcd. Changes to thresholds trigger a recalculation event for historical data if required by the user.

### 6.4 Key Features and Functions

#### 6.4.1 Availability and Data Sufficiency
Before any complex calculation is performed, the system verifies data sufficiency. A minimum of 70% sensor uptime (valid SDPs received vs. expected based on sampling rate) is required within the requested time window (e.g., 24 hours) for a valid TIGR or Pattern to be generated. If sufficiency is not met, the API returns a `DATA_INSUFFICIENT` status.

#### 6.4.2 Average Soil Moisture & Temp Statistics
Rolling averages are calculated using a simple moving average (SMA) algorithm over a sliding window (typically 24 hours). The calculation is updated incrementally as new SDPs arrive, rather than recalculating the entire window from scratch, to optimize CPU utilization.

#### 6.4.3 Sensor Usage Statistics
The system calculates sensor uptime by analyzing the gap duration between consecutive SDPs. A gap exceeding 3x the expected transmission interval (e.g., >15 minutes for a 5-minute interval sensor) is logged as "downtime."

#### 6.4.4 Time in Optimal Growth Range (TIGR) Statistics
(Detailed in Section 6.5)

#### 6.4.5 Microclimate Anomaly Pattern Detection
(Detailed in Section 6.6)

### 6.5 Time in Optimal Growth Range Calculations
The TIGR calculation determines the percentage of time a specific zone spent in predefined states: `Too Dry/Cold`, `Optimal`, or `Too Wet/Hot`.

#### 6.5.1 Defining Discrete Ranges from Given Thresholds
The user defines three critical thresholds for a given metric (e.g., Temperature):
- Minimum Critical Threshold (e.g., 15°C)
- Optimal Lower Bound (e.g., 20°C)
- Optimal Upper Bound (e.g., 26°C)
- Maximum Critical Threshold (e.g., 32°C)

These define discrete ranges:
- `Critical Low`: < Minimum Critical
- `Sub-Optimal Low`: >= Minimum Critical AND < Optimal Lower
- `Optimal`: >= Optimal Lower AND <= Optimal Upper
- `Sub-Optimal High`: > Optimal Upper AND <= Maximum Critical
- `Critical High`: > Maximum Critical

#### 6.5.2 Algorithm to Group Sensor Data Points
1. Retrieve all valid SDPs for the requested time window and specific sensor/zone.
2. Iterate through the array of SDPs.
3. For each SDP, evaluate its value against the defined discrete ranges (6.5.1).
4. Increment a counter corresponding to the matched range.
5. After processing all SDPs, calculate the percentage: `(Count in Range / Total Valid SDPs) * 100`.

#### 6.5.3 Time in Range Display Rounding
To ensure UI consistency, calculated percentages are rounded to the nearest whole integer using standard "round half up" logic. If the sum of all rounded percentages does not equal 100%, the largest percentage category is adjusted by ±1% to force the sum to 100%.

### 6.6 Microclimate Anomaly Patterns Algorithm
This algorithm detects recurring environmental deviations that might indicate systemic issues (e.g., a vent sticking open at the same time every night causing a localized temperature drop).

#### 6.6.1 Required Inputs
- Minimum of 7 days of continuous SDP data for a specific zone.
- Defined `Anomaly Thresholds` (e.g., humidity drop > 15% within 30 minutes).

#### 6.6.2 Step 1: Separate the Sensor Data into Low/High Moisture/Temp Groups
The historical data is scanned to identify all discrete "events" where the sensor reading breached the `Anomaly Thresholds`. These events are categorized as either "High Anomaly" or "Low Anomaly" events.

#### 6.6.3 Step 2: Create Modal Points and Modal Days
A "Modal Day" is constructed consisting of 288 "Modal Points" (representing 5-minute intervals over 24 hours). This serves as a template to aggregate historical anomalies by time-of-day.

#### 6.6.4 Step 3: Populate Modal Days
For every identified anomaly event (from Step 1), increment the corresponding Modal Point in the Modal Day template that aligns with the event's time-of-day.

#### 6.6.5 Step 4: Find the Number of Contributing Days
Determine how many unique calendar days contributed to the count at each Modal Point. A recurring pattern requires anomalies on multiple distinct days.

#### 6.6.6 Step 5: Make Double Periods
To account for patterns that span across midnight (e.g., 23:00 to 02:00), the Modal Day array is duplicated and appended to itself, creating a 48-hour continuous array for analysis.

#### 6.6.7 Step 6: Identify Low and High Start Points
Scan the double-period array for continuous blocks of Modal Points where the anomaly count exceeds a significance threshold (e.g., anomalies occurred at this specific time on at least 3 out of the last 7 days). The beginning of such a block is marked as a Start Point.

#### 6.6.8 Step 7: Find Low and High Pattern Instances
Trace from the Start Point to determine the duration of the recurring anomaly block. A valid Pattern Instance must have a minimum duration (e.g., at least 30 minutes).

#### 6.6.9 Step 8: Separate Significant Matches into Daytime and Nighttime Categories
Based on the facility's defined "Lights On" and "Lights Off" schedule, categorize each Pattern Instance. Anomalies occurring during active photoperiods often have different root causes than nighttime anomalies.

#### 6.6.10 Step 9: Sort Matches by Volume
Rank the identified Pattern Instances based on "Volume" (calculated as: Duration of the pattern block * Number of contributing days). The highest volume patterns are prioritized for alerting to the user.

### 6.7 Security and Data Governance
All algorithms execute within isolated, ephemeral containers with read-only access to the PostgreSQL database. Only aggregated statistical results (Averages, TIGR, Patterns) are written back to the database. Raw SDPs are never modified or deleted by the analytical engines, preserving a strict, immutable audit trail for regulatory compliance.

## 7. ATTACHMENTS
(Intentionally left blank for this revision)
