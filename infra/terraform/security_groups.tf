# allow_db_from_my_ip is defined in variables.tf

resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "EC2: HTTP/HTTPS from world, SSH from admin CIDR only, port 4000 for API debug"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH — admin only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # API direct access — useful during initial deployment verification.
  # Remove or restrict once nginx proxying is confirmed stable.
  ingress {
    description = "API debug port"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${var.project_name}-ec2-sg" })
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "RDS: allow Postgres 5432 from EC2 SG only — never from 0.0.0.0/0"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EC2 SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${var.project_name}-rds-sg" })
}

# Optional: temporary admin access to RDS from your IP (e.g. to run psql from
# your machine). Only created when allow_db_from_my_ip = true.
resource "aws_security_group_rule" "rds_admin_from_my_ip" {
  count = var.allow_db_from_my_ip ? 1 : 0

  type              = "ingress"
  description       = "TEMP admin/debug Postgres from allowed_ssh_cidr"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [var.allowed_ssh_cidr]
  security_group_id = aws_security_group.rds.id
}
