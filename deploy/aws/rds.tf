resource "random_password" "db_password" {
  length  = 32
  special = false

  lifecycle {
    ignore_changes = [result]
  }
}

resource "aws_security_group" "rds" {
  name        = "threatforge-rds-sg"
  description = "Allow PostgreSQL from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "threatforge-rds-sg"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "threatforge-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "threatforge-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier        = "threatforge"
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = var.db_instance_class
  allocated_storage = 20
  max_allocated_storage = 100

  db_name  = "threatforge"
  username = "threatforge"
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.db_deletion_protection
  skip_final_snapshot = false
  final_snapshot_identifier = "threatforge-final-snapshot"

  storage_encrypted = true
  multi_az          = false

  performance_insights_enabled = true

  tags = {
    Name = "threatforge-rds"
  }
}
