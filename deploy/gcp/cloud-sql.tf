resource "random_password" "db_password" {
  length  = 32
  special = false

  lifecycle {
    ignore_changes = [result]
  }
}

resource "google_sql_database_instance" "main" {
  name             = "threatforge-db"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    disk_autoresize   = true
    disk_autoresize_limit = 100

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
      }
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      ssl_mode        = "REQUIRE"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    user_labels = {
      project    = "threatforge"
      managed_by = "terraform"
    }
  }

  depends_on = [
    google_project_service.sql,
    google_project_service.sqladmin,
    google_service_networking_connection.private_vpc_connection,
  ]
}

resource "google_sql_database" "threatforge" {
  name     = "threatforge"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

resource "google_sql_user" "threatforge" {
  name     = "threatforge"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

output "database_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.main.connection_name
}
