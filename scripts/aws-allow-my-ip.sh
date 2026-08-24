#!/bin/bash
#
# aws-allow-my-ip.sh
# ------------------
# Purpose:      Re-point the security group's SSH rule at this machine's current
#               public IP.
#
#               The deployer's IP is almost always a dynamic residential lease.
#               Pinning SSH to it is right for security but breaks the moment the
#               lease changes — run this to restore access.
#
# Usage:        ./scripts/aws-allow-my-ip.sh [-h|--help]
#
# Prerequisites: aws CLI authenticated with EC2 rights; curl.
#
# What it does:
#   1. Reads this machine's current public IP.
#   2. Revokes every existing port-22 rule on the group.
#   3. Authorizes port 22 from the current IP only.
#
# Locked out anyway? SSH is not the only way in. The instance carries an SSM
# instance profile, so this works regardless of IP or security group:
#
#     aws ssm start-session --target <instance-id>
#
# Environment variables:
#   SG_NAME    Security group name. Default: portal-brasileirao
#   AWS_PROFILE / AWS_REGION honoured as usual.
#
# Exit codes:
#   0  SSH rule now points at this machine.
#   1  Group not found, or the AWS call failed.

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

SG_NAME="${SG_NAME:-portal-brasileirao}"

group_id="$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SG_NAME}" \
    --query 'SecurityGroups[0].GroupId' --output text)"

if [[ -z "$group_id" || "$group_id" == "None" ]]; then
    echo "Error: security group '${SG_NAME}' not found." >&2
    exit 1
fi

my_ip="$(curl -fsS https://checkip.amazonaws.com | tr -d '\n')"
if [[ -z "$my_ip" ]]; then
    echo "Error: could not determine this machine's public IP." >&2
    exit 1
fi

echo "==> Security group ${SG_NAME} (${group_id})"
echo "==> Current public IP: ${my_ip}"

# shellcheck disable=SC2016  # backticks here are JMESPath literals, not shell
existing="$(aws ec2 describe-security-groups --group-ids "$group_id" \
    --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`].IpRanges[].CidrIp' \
    --output text)"

if [[ "$existing" == *"${my_ip}/32"* ]]; then
    echo "Already authorized — nothing to do."
    exit 0
fi

for cidr in $existing; do
    echo "--> revoking SSH from ${cidr}"
    aws ec2 revoke-security-group-ingress --group-id "$group_id" \
        --protocol tcp --port 22 --cidr "$cidr" > /dev/null
done

echo "--> authorizing SSH from ${my_ip}/32"
aws ec2 authorize-security-group-ingress --group-id "$group_id" \
    --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${my_ip}/32,Description=deployer}]" \
    > /dev/null

echo "Done."
