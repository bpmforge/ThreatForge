resource "google_redis_instance" "cache" {
  name           = "threatforge-cache"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_gb
  region         = var.region
  project        = var.project_id

  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version = "REDIS_7_0"

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  depends_on = [
    google_project_service.redis,
    google_service_networking_connection.private_vpc_connection,
  ]
}
