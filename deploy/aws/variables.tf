variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "app_version" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "domain" {
  description = "Domain name for ThreatForge (used as NEXTAUTH_URL)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on the RDS instance"
  type        = bool
  default     = true
}

variable "cache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "server_desired_count" {
  description = "Desired number of ECS tasks for the server"
  type        = number
  default     = 2
}

variable "server_max_count" {
  description = "Maximum number of ECS tasks for the server (auto scaling)"
  type        = number
  default     = 10
}

variable "frontend_desired_count" {
  description = "Desired number of ECS tasks for the frontend"
  type        = number
  default     = 2
}

variable "frontend_max_count" {
  description = "Maximum number of ECS tasks for the frontend (auto scaling)"
  type        = number
  default     = 5
}

variable "encrypt_at_rest" {
  description = "Enable application-level encryption at rest"
  type        = bool
  default     = false
}

variable "auth_secret" {
  description = "Auth.js secret for session signing"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for API tokens"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for application-level data encryption (required when encrypt_at_rest = true)"
  type        = string
  sensitive   = true
  default     = ""
}
