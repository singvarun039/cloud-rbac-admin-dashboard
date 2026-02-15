data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  rds_endpoint = var.enable_rds ? aws_db_instance.postgres[0].address : ""
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public_a.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  key_name                    = var.key_pair_name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/userdata.tftpl", {
    github_repo_url = var.github_repo_url
    enable_rds      = var.enable_rds
    rds_endpoint    = local.rds_endpoint
    db_name         = var.db_name
    db_username     = var.db_username
    db_password     = var.db_password
    jwt_secret      = var.jwt_secret
    cors_origin     = var.cors_origin
  })

  tags = merge(local.tags, { Name = "${var.project_name}-ec2" })

  depends_on = [aws_internet_gateway.igw]
}
