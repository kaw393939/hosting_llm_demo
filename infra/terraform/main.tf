resource "random_password" "root" {
  length           = 32
  special          = true
  override_special = "!@#$%^&*()-_=+[]{}<>:?"
}

resource "linode_instance" "platform" {
  label      = var.label
  region     = var.region
  type       = var.instance_type
  image      = "linode/ubuntu24.04"
  root_pass  = random_password.root.result
  authorized_keys = [
    var.admin_authorized_key
  ]
  private_ip = true
  tags       = var.tags
}

resource "linode_firewall" "platform" {
  label = "${var.label}-firewall"
  tags  = var.tags

  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label    = "allow-ssh"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "22"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  inbound {
    label    = "allow-http"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "80"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  inbound {
    label    = "allow-https"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "443"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  linodes = [linode_instance.platform.id]
}
