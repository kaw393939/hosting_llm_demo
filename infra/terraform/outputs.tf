output "public_ipv4" {
  description = "Public IPv4 address for the platform server"
  value       = linode_instance.platform.ip_address
}

output "public_ipv6" {
  description = "Public IPv6 range (if assigned)"
  value       = try(linode_instance.platform.ipv6, null)
}

output "hostname" {
  description = "Linode hostname label"
  value       = linode_instance.platform.label
}

output "instance_id" {
  description = "Linode instance ID"
  value       = linode_instance.platform.id
}
