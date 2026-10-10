resource "google_compute_network" "vpc" {
  name                    = "threatforge-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  # google_compute_network does not support labels; tagging is handled at the project level
  depends_on = [google_project_service.compute]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "threatforge-subnet"
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = "10.0.0.0/24"
  project       = var.project_id
}

# Serverless VPC connector for Cloud Run → VPC connectivity
resource "google_vpc_access_connector" "connector" {
  name          = "threatforge-connector"
  region        = var.region
  project       = var.project_id
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.vpc.name

  depends_on = [google_project_service.vpcaccess]
}

# Private services access for Cloud SQL private IP
resource "google_compute_global_address" "private_ip_range" {
  name          = "threatforge-private-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]

  depends_on = [google_project_service.servicenetworking]
}
