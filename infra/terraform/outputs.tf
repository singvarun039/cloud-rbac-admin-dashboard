output "ec2_public_ip" {
  description = "Public IPv4 of the EC2 Docker host"
  value       = aws_instance.app.public_ip
}

output "web_url" {
  description = "Frontend URL (nginx serving React)"
  value       = "http://${aws_instance.app.public_ip}/"
}

output "api_health_url" {
  description = "API health via nginx proxy"
  value       = "http://${aws_instance.app.public_ip}/api/health"
}

output "rds_endpoint" {
  description = "RDS endpoint hostname"
  value       = var.enable_rds ? aws_db_instance.postgres[0].address : "(enable_rds=false)"
}

output "ec2_public_dns" {
  description = "Public DNS hostname of the EC2 instance"
  value       = aws_instance.app.public_dns
}

output "ssh_command" {
  description = "SSH command"
  value       = "ssh -i <path-to-private-key.pem> ubuntu@${aws_instance.app.public_ip}"
}

output "ec2_sg_id" {
  description = "ID of the EC2 security group"
  value       = aws_security_group.ec2.id
}

output "rds_sg_id" {
  description = "ID of the RDS security group"
  value       = var.enable_rds ? aws_security_group.rds.id : "(enable_rds=false)"
}

output "estimated_monthly_cost_note" {
  description = "Reminder to destroy resources to avoid ongoing charges"
  value       = "This stack includes RDS + EC2. To minimize cost, run: terraform destroy (especially do not leave RDS running)."
}
