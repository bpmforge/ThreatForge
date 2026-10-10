# Auth secret
resource "aws_secretsmanager_secret" "auth_secret" {
  name                    = "threatforge/auth-secret"
  recovery_window_in_days = 7

  tags = {
    Name = "threatforge-auth-secret"
  }
}

resource "aws_secretsmanager_secret_version" "auth_secret" {
  secret_id     = aws_secretsmanager_secret.auth_secret.id
  secret_string = var.auth_secret
}

# JWT secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "threatforge/jwt-secret"
  recovery_window_in_days = 7

  tags = {
    Name = "threatforge-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

# Database URL
resource "aws_secretsmanager_secret" "db_url" {
  name                    = "threatforge/db-url"
  recovery_window_in_days = 7

  tags = {
    Name = "threatforge-db-url"
  }
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "postgresql://threatforge:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/threatforge"
}

# Encryption key (conditional)
resource "aws_secretsmanager_secret" "encryption_key" {
  count                   = var.encrypt_at_rest ? 1 : 0
  name                    = "threatforge/encryption-key"
  recovery_window_in_days = 7

  tags = {
    Name = "threatforge-encryption-key"
  }
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  count         = var.encrypt_at_rest ? 1 : 0
  secret_id     = aws_secretsmanager_secret.encryption_key[0].id
  secret_string = var.encryption_key
}

# IAM policy for ECS task role to read secrets
data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid    = "ReadThreatForgeSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = concat(
      [
        aws_secretsmanager_secret.auth_secret.arn,
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.db_url.arn,
      ],
      var.encrypt_at_rest ? [aws_secretsmanager_secret.encryption_key[0].arn] : []
    )
  }
}

resource "aws_iam_policy" "secrets_read" {
  name        = "threatforge-secrets-read"
  description = "Allow ECS tasks to read ThreatForge secrets from Secrets Manager"
  policy      = data.aws_iam_policy_document.secrets_read.json

  tags = {
    Name = "threatforge-secrets-read-policy"
  }
}
