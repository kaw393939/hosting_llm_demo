variable "linode_token" {
  description = "Linode API token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Linode region"
  type        = string
  default     = "us-east"
}

variable "instance_type" {
  description = "Linode instance type"
  type        = string
  default     = "g6-nanode-1"
}

variable "label" {
  description = "Instance label"
  type        = string
  default     = "keith-platform"
}

variable "admin_authorized_key" {
  description = "SSH public key for initial root access and admin user"
  type        = string
}

variable "tags" {
  description = "Tags to apply to Linode resources"
  type        = list(string)
  default     = ["keithwilliams", "platform", "traefik", "postgres"]
}
