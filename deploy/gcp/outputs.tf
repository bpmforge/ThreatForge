output "server_url" {
  description = "Cloud Run URL for the ThreatForge server"
  value       = google_cloud_run_v2_service.server.uri
}

output "frontend_url" {
  description = "Cloud Run URL for the ThreatForge frontend"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "redis_host" {
  description = "Memorystore Redis host IP"
  value       = google_redis_instance.cache.host
}

output "vpc_connector_name" {
  description = "Serverless VPC connector name"
  value       = google_vpc_access_connector.connector.name
}
