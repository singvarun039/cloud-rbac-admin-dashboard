variable "aws_region" {
  type        = string
  description = "AWS region to deploy into (e.g. us-east-1)."
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Prefix for resource names/tags."
  default     = "cloud-rbac"
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "Your public IP in CIDR notation for SSH (e.g. 203.0.113.10/32)."

  validation {
    condition = can(
      regex(
        "^(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}/32$",
        var.allowed_ssh_cidr
      )
    )
    error_message = "allowed_ssh_cidr must be a single IPv4 /32, e.g. 203.0.113.10/32."
  }
}

variable "key_pair_name" {
  type        = string
  description = "Existing EC2 key pair name in this region."
}

variable "github_repo_url" {
  type        = string
  description = "HTTPS Git URL to clone on the EC2 instance (public repo recommended)."
}

variable "github_repo_branch" {
  type        = string
  description = "Git branch to deploy on the EC2 instance."
  default     = "main"
}

variable "github_repo_token" {
  type        = string
  description = "Optional GitHub token for cloning private repos. Keep this in terraform.tfvars (never commit). Prefer using an SSH deploy key if possible."
  sensitive   = true
  default     = ""
}

variable "allow_db_from_my_ip" {
  type        = bool
  description = "If true, temporarily allow inbound Postgres (5432) from allowed_ssh_cidr for admin/debug. Default false."
  default     = false
}

variable "ec2_instance_type" {
  type        = string
  description = "EC2 instance type. t3.small is the recommended minimum — t2.micro is too weak for stable Docker builds."
  default     = "t3.small"
}

variable "enable_swap" {
  type        = bool
  description = "If true, user_data creates a swap file. Recommended for t3.small/t2.micro to prevent OOM kills during Docker builds."
  default     = true
}

variable "swap_size_gb" {
  type        = number
  description = "Size of the swap file in GiB. Only used when enable_swap = true."
  default     = 2

  validation {
    condition     = var.swap_size_gb >= 1 && var.swap_size_gb <= 16
    error_message = "swap_size_gb must be between 1 and 16."
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class (db.t3.micro is free-tier eligible)."
  default     = "db.t3.micro"
}

variable "db_allocated_storage_gb" {
  type        = number
  description = "RDS gp2 allocated storage in GB (minimum 20)."
  default     = 20

  validation {
    condition     = var.db_allocated_storage_gb >= 20
    error_message = "db_allocated_storage_gb must be >= 20 (RDS minimum)."
  }
}

variable "db_name" {
  type        = string
  description = "Initial database name."
  default     = "crbad"
}

variable "db_username" {
  type        = string
  description = "Master username for Postgres."
  default     = "postgres"
}

variable "db_password" {
  type        = string
  description = "Master password for Postgres — set in terraform.tfvars, never commit."
  sensitive   = true

  validation {
    condition = (
      length(var.db_password) >= 20 &&
      can(regex("[a-z]", var.db_password)) &&
      can(regex("[A-Z]", var.db_password)) &&
      can(regex("[0-9]", var.db_password)) &&
      can(regex("[^0-9A-Za-z]", var.db_password))
    )
    error_message = "db_password must be >= 20 chars and include at least 1 lowercase, 1 uppercase, 1 number, and 1 special character."
  }
}

variable "jwt_secret" {
  type        = string
  description = "Secret used to derive JWT access/refresh + refresh HMAC secrets."
  sensitive   = true
}

variable "cors_origin" {
  type        = string
  description = "Origin allowlist for the API (FRONTEND_ORIGIN). Use http(s)://... . You may also use 'auto' to derive http://<ec2_public_ip>, or use the placeholder http://TEMP for a first apply. Must not be '*'."
  default     = "http://TEMP"

  validation {
    condition = (
      var.cors_origin == "auto" ||
      var.cors_origin == "http://TEMP" ||
      can(regex("^https?://", var.cors_origin))
    )
    error_message = "cors_origin must be 'auto', start with http:// or https://, or be exactly http://TEMP for the first apply."
  }
}

variable "enable_rds" {
  type        = bool
  description = "Cost-safety toggle: when false, skips creating RDS (app will not start)."
  default     = true
}
