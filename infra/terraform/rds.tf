resource "aws_db_subnet_group" "main" {
  count = var.enable_rds ? 1 : 0

  name       = "${var.project_name}-db-subnets"
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = merge(local.tags, { Name = "${var.project_name}-db-subnets" })
}

resource "aws_db_instance" "postgres" {
  count = var.enable_rds ? 1 : 0

  identifier        = "${var.project_name}-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage_gb
  storage_type      = "gp3"
  db_name           = var.db_name
  username          = var.db_username
  password          = var.db_password

  # Single-AZ to keep cost/complexity low.
  multi_az          = false
  availability_zone = data.aws_availability_zones.available.names[0]

  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false

  skip_final_snapshot = true
  deletion_protection = false

  # RDS defaults are fine for a dev/portfolio setup; keep it minimal.
  backup_retention_period = 0

  tags = merge(local.tags, { Name = "${var.project_name}-postgres" })
}
