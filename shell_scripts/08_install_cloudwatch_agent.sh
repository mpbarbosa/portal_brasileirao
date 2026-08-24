#!/bin/bash
#
# 08_install_cloudwatch_agent.sh
# ------------------------------
# Purpose:      Install and configure the CloudWatch agent so the host reports
#               memory and disk usage. EC2 publishes neither natively — it can
#               see CPU and status checks from outside the guest, but not what
#               is happening inside it. On a host with under 1 GB of RAM, memory
#               is the metric most likely to matter.
#
# Usage:        ./shell_scripts/08_install_cloudwatch_agent.sh
#
# Prerequisites:
#   - The instance role carries CloudWatchAgentServerPolicy.
#   - sudo access.
#
# Exit codes:
#   0  Agent installed, configured and running.
#   1  Download or startup failed.

set -euo pipefail

AGENT_DEB="https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb"
CONFIG=/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
CTL=/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl

if ! [[ -x "$CTL" ]]; then
    echo "==> Downloading the CloudWatch agent..."
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    curl -fsSL "$AGENT_DEB" -o "$tmp/amazon-cloudwatch-agent.deb"
    sudo dpkg -i -E "$tmp/amazon-cloudwatch-agent.deb"
else
    echo "==> Agent already installed"
fi

echo "==> Writing $CONFIG..."
# aggregation_dimensions matters: the agent tags disk metrics with path, device
# and fstype, and CloudWatch matches dimensions exactly — an alarm on
# {InstanceId, path} would never match a metric carrying four dimensions. The
# rollups below emit exactly the shapes the alarms watch for.
sudo tee "$CONFIG" > /dev/null <<'JSON'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "namespace": "CWAgent",
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    },
    "aggregation_dimensions": [["InstanceId"], ["InstanceId", "path"]],
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/"]
      }
    }
  }
}
JSON

echo "==> Starting the agent..."
sudo "$CTL" -a fetch-config -m ec2 -s -c "file:${CONFIG}"

echo ""
sudo "$CTL" -a status
