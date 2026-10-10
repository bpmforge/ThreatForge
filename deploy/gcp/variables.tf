variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "app_version" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "domain" {
  description = "Domain name for ThreatForge (used as Cloud Run custom domain and NEXTAUTH_URL)"
  type        = string
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-g1-small"
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the Cloud SQL instance"
  type        = bool
  default     = true
}

variable "redis_tier" {
  description = "Memorystore Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
}

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "server_min_instances" {
  description = "Minimum number of Cloud Run instances for the server"
  type        = number
  default     = 1
}

variable "server_max_instances" {
  description = "Maximum number of Cloud Run instances for the server"
  type        = number
  default     = 10
}

variable "frontend_min_instances" {
  description = "Minimum number of Cloud Run instances for the frontend"
  type        = number
  default     = 1
}

variable "frontend_max_instances" {
  description = "Maximum number of Cloud Run instances for the frontend"
  type        = number
  default     = 5
}

variable "encrypt_at_rest" {
  description = "Enable application-level encryption at rest (provides ENCRYPTION_KEY to server)"
  type        = bool
  default     = false
}

variable "secret_auth_secret" {
  description = "Auth.js secret for session signing"
  type        = string
  sensitive   = true
}

variable "secret_jwt_secret" {
  description = "JWT secret for API tokens"
  type        = string
  sensitive   = true
}

variable "secret_encryption_key" {
  description = "Encryption key for application-level data encryption (required when encrypt_at_rest = true)"
  type        = string
  sensitive   = true
  default     = ""
}
