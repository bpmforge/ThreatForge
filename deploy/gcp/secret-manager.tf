# Auth secret
resource "google_secret_manager_secret" "auth_secret" {
  secret_id = "threatforge-auth-secret"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "auth_secret" {
  secret      = google_secret_manager_secret.auth_secret.id
  secret_data = var.secret_auth_secret
}

resource "google_secret_manager_secret_iam_member" "auth_secret_accessor" {
  secret_id = google_secret_manager_secret.auth_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
  project   = var.project_id
}

# JWT secret
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "threatforge-jwt-secret"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.secret_jwt_secret
}

resource "google_secret_manager_secret_iam_member" "jwt_secret_accessor" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
  project   = var.project_id
}

# Database URL (constructed from Cloud SQL private IP + credentials)
resource "google_secret_manager_secret" "db_url" {
  secret_id = "threatforge-db-url"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "db_url" {
  secret      = google_secret_manager_secret.db_url.id
  secret_data = "postgresql://threatforge:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/threatforge"
}

resource "google_secret_manager_secret_iam_member" "db_url_accessor" {
  secret_id = google_secret_manager_secret.db_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
  project   = var.project_id
}

# Encryption key (only created when encrypt_at_rest is enabled)
resource "google_secret_manager_secret" "encryption_key" {
  count     = var.encrypt_at_rest ? 1 : 0
  secret_id = "threatforge-encryption-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    project    = "threatforge"
    managed_by = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "encryption_key" {
  count       = var.encrypt_at_rest ? 1 : 0
  secret      = google_secret_manager_secret.encryption_key[0].id
  secret_data = var.secret_encryption_key
}

resource "google_secret_manager_secret_iam_member" "encryption_key_accessor" {
  count     = var.encrypt_at_rest ? 1 : 0
  secret_id = google_secret_manager_secret.encryption_key[0].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
  project   = var.project_id
}
