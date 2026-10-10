# Server Cloud Run service
resource "google_cloud_run_v2_service" "server" {
  name     = "threatforge-server"
  location = var.region
  project  = var.project_id

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.server_min_instances
      max_instance_count = var.server_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "bpmforge/threatforge-server:${var.app_version}"

      ports {
        container_port = 4000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "4000"
      }

      env {
        name  = "ENCRYPT_AT_REST"
        value = tostring(var.encrypt_at_rest)
      }

      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.cache.host}:6379"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.encrypt_at_rest ? [1] : []
        content {
          name = "ENCRYPTION_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.encryption_key[0].secret_id
              version = "latest"
            }
          }
        }
      }

      liveness_probe {
        http_get {
          path = "/health/live"
          port = 4000
        }
        initial_delay_seconds = 10
        period_seconds        = 30
        failure_threshold     = 3
      }

      startup_probe {
        http_get {
          path = "/health/ready"
          port = 4000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_version.db_url,
    google_secret_manager_secret_version.auth_secret,
    google_secret_manager_secret_version.jwt_secret,
  ]
}

# Allow unauthenticated access to server (public API)
resource "google_cloud_run_v2_service_iam_member" "server_public" {
  name     = google_cloud_run_v2_service.server.name
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Frontend Cloud Run service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "threatforge-frontend"
  location = var.region
  project  = var.project_id

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.frontend_min_instances
      max_instance_count = var.frontend_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "bpmforge/threatforge-frontend:${var.app_version}"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "NEXTAUTH_URL"
        value = "https://${var.domain}"
      }

      env {
        name  = "AUTH_URL"
        value = "https://${var.domain}"
      }

      env {
        name  = "INTERNAL_API_URL"
        value = google_cloud_run_v2_service.server.uri
      }

      env {
        name  = "DATABASE_PROVIDER"
        value = "postgresql"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }

      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 30
        failure_threshold     = 3
      }

      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 12
      }
    }
  }

  depends_on = [
    google_project_service.run,
    google_cloud_run_v2_service.server,
    google_secret_manager_secret_version.db_url,
    google_secret_manager_secret_version.auth_secret,
  ]
}

# Allow unauthenticated access to frontend
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = var.region
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}
