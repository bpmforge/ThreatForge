{{/*
Expand the name of the chart.
*/}}
{{- define "threatforge.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "threatforge.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "threatforge.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "threatforge.labels" -}}
helm.sh/chart: {{ include "threatforge.chart" . }}
{{ include "threatforge.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "threatforge.selectorLabels" -}}
app.kubernetes.io/name: {{ include "threatforge.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "threatforge.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "threatforge.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Server fully qualified name
*/}}
{{- define "threatforge.server.fullname" -}}
{{- printf "%s-server" (include "threatforge.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Frontend fully qualified name
*/}}
{{- define "threatforge.frontend.fullname" -}}
{{- printf "%s-frontend" (include "threatforge.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Resolve the secret name: use existingSecret if set, otherwise use the chart-managed secret.
*/}}
{{- define "threatforge.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- printf "%s-secret" (include "threatforge.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Redis host: use subchart service when redis.enabled, otherwise allow override.
*/}}
{{- define "threatforge.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" .Release.Name }}
{{- else }}
{{- .Values.externalRedis.host | default "redis" }}
{{- end }}
{{- end }}

{{/*
Resolve CORS origin: fall back to ingress host when not explicitly set.
*/}}
{{- define "threatforge.corsOrigin" -}}
{{- if .Values.config.corsOrigin }}
{{- .Values.config.corsOrigin }}
{{- else if .Values.ingress.enabled }}
{{- printf "https://%s" .Values.ingress.host }}
{{- else }}
{{- "http://localhost:3000" }}
{{- end }}
{{- end }}
