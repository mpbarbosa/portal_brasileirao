#!/bin/bash
#
# aws-setup-monitoring.sh
# -----------------------
# Purpose:      Create (or update) monitoring and alerting for the production
#               host. Idempotent — safe to re-run; it updates in place rather
#               than duplicating.
#
# Usage:        AWS_PROFILE=mpb ./scripts/aws-setup-monitoring.sh [-h|--help]
#
# What it creates:
#   - Two SNS topics, one per region. CloudWatch alarms can only publish to a
#     topic in their own region, and Route 53 health-check metrics exist only in
#     us-east-1, so a single topic cannot serve both.
#   - EC2 alarms (sa-east-1): instance and system status checks, high CPU.
#   - A Route 53 health check against the public /api/health endpoint, plus an
#     alarm on it (us-east-1). This is the one that matters most: it fails when
#     the *site* is down, whatever the cause — process, nginx, disk, network —
#     and it checks from outside AWS rather than asking the host about itself.
#   - Host alarms (sa-east-1) on memory and disk, which EC2 does not report
#     natively; they need the CloudWatch agent from
#     shell_scripts/08_install_cloudwatch_agent.sh.
#
# The email subscription must be confirmed from the inbox before anything is
# delivered — AWS will not send to an unconfirmed address.
#
# Environment variables:
#   ALERT_EMAIL   Where alerts go. Default: mpbarbosa@gmail.com
#   INSTANCE_ID   Default: i-03a9afc8a469edc89
#   DOMAIN        Default: brasileirao.mpbarbosa.com
#
# Cost: roughly US$2-3/month — alarms at US$0.10 each, the health check at
# US$0.50, and a handful of custom metrics.
#
# Exit codes:
#   0  Monitoring is in place.
#   1  An AWS call failed.

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

ALERT_EMAIL="${ALERT_EMAIL:-mpbarbosa@gmail.com}"
INSTANCE_ID="${INSTANCE_ID:-i-03a9afc8a469edc89}"
DOMAIN="${DOMAIN:-brasileirao.mpbarbosa.com}"
APP_REGION="sa-east-1"
GLOBAL_REGION="us-east-1"
TOPIC_NAME="portal-brasileirao-alerts"

echo "==> SNS topics and subscriptions"
declare -A TOPIC_ARN
for region in "$APP_REGION" "$GLOBAL_REGION"; do
    arn=$(aws sns create-topic --name "$TOPIC_NAME" --region "$region" \
        --query 'TopicArn' --output text)
    TOPIC_ARN[$region]="$arn"

    # Re-subscribing an already-subscribed address would queue a second
    # confirmation email, so only subscribe when the address is absent.
    if aws sns list-subscriptions-by-topic --topic-arn "$arn" --region "$region" \
            --query 'Subscriptions[].Endpoint' --output text | grep -qF "$ALERT_EMAIL"; then
        echo "    ${region}: ${ALERT_EMAIL} already subscribed"
    else
        aws sns subscribe --topic-arn "$arn" --protocol email \
            --notification-endpoint "$ALERT_EMAIL" --region "$region" > /dev/null
        echo "    ${region}: subscription requested — confirm it from ${ALERT_EMAIL}"
    fi
done

alarm() {
    local region="$1"; shift
    aws cloudwatch put-metric-alarm --region "$region" \
        --alarm-actions "${TOPIC_ARN[$region]}" \
        --ok-actions "${TOPIC_ARN[$region]}" \
        "$@"
}

echo "==> EC2 alarms (${APP_REGION})"

# Status checks are the bluntest signal: the instance is unreachable or the
# hypervisor is unhappy. Treat missing data as breaching — no data from a health
# signal is itself bad news.
alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-instance-status \
    --alarm-description "EC2 instance status check failing" \
    --namespace AWS/EC2 --metric-name StatusCheckFailed_Instance \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" \
    --statistic Maximum --period 60 --evaluation-periods 2 \
    --threshold 0 --comparison-operator GreaterThanThreshold \
    --treat-missing-data breaching
echo "    instance status check"

alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-system-status \
    --alarm-description "EC2 system status check failing (AWS-side)" \
    --namespace AWS/EC2 --metric-name StatusCheckFailed_System \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" \
    --statistic Maximum --period 60 --evaluation-periods 2 \
    --threshold 0 --comparison-operator GreaterThanThreshold \
    --treat-missing-data breaching
echo "    system status check"

# t3.micro is burstable: sustained high CPU means credits are draining and the
# instance will be throttled to baseline.
alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-cpu-high \
    --alarm-description "CPU above 80% for 15 minutes" \
    --namespace AWS/EC2 --metric-name CPUUtilization \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" \
    --statistic Average --period 300 --evaluation-periods 3 \
    --threshold 80 --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching
echo "    CPU high"

# This instance runs in `unlimited` credit mode, where exhausting the credit
# balance does not throttle anything — AWS bills for surplus CPU instead. So a
# "credit balance low" alarm measures something that cannot cause an outage, and
# fires spuriously on a young instance whose balance is still accruing (a fresh
# t3.micro earns ~6/hour toward a 144 cap). The meaningful signal in unlimited
# mode is surplus actually being charged: sustained surplus means the workload
# has outgrown the instance, and it costs money.
alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-cpu-surplus-charged \
    --alarm-description "Burst CPU surplus billed for 30 minutes straight — workload outgrowing t3.micro" \
    --namespace AWS/EC2 --metric-name CPUSurplusCreditsCharged \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" \
    --statistic Sum --period 300 --evaluation-periods 6 \
    --threshold 0 --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching
echo "    CPU surplus charged"

echo "==> Route 53 health check on https://${DOMAIN}/api/health"
existing=$(aws route53 list-health-checks \
    --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='${DOMAIN}'].Id" \
    --output text | head -1)

if [[ -n "$existing" && "$existing" != "None" ]]; then
    HEALTH_CHECK_ID="$existing"
    echo "    reusing ${HEALTH_CHECK_ID}"
else
    HEALTH_CHECK_ID=$(aws route53 create-health-check \
        --caller-reference "portal-brasileirao-$(date +%s)" \
        --health-check-config "Type=HTTPS,FullyQualifiedDomainName=${DOMAIN},Port=443,ResourcePath=/api/health,RequestInterval=30,FailureThreshold=3,MeasureLatency=true" \
        --query 'HealthCheck.Id' --output text)
    aws route53 change-tags-for-resource --resource-type healthcheck \
        --resource-id "$HEALTH_CHECK_ID" \
        --add-tags "Key=Name,Value=portal-brasileirao" > /dev/null
    echo "    created ${HEALTH_CHECK_ID}"
fi

# Route 53 publishes health-check metrics only into us-east-1, regardless of
# where the endpoint actually lives.
alarm "$GLOBAL_REGION" \
    --alarm-name portal-brasileirao-site-down \
    --alarm-description "https://${DOMAIN}/api/health is failing from outside AWS" \
    --namespace AWS/Route53 --metric-name HealthCheckStatus \
    --dimensions "Name=HealthCheckId,Value=${HEALTH_CHECK_ID}" \
    --statistic Minimum --period 60 --evaluation-periods 2 \
    --threshold 1 --comparison-operator LessThanThreshold \
    --treat-missing-data breaching
echo "    site-down alarm"

echo "==> Host alarms (${APP_REGION}) — need the CloudWatch agent"
alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-memory-high \
    --alarm-description "Memory above 85% (host has under 1 GB)" \
    --namespace CWAgent --metric-name mem_used_percent \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" \
    --statistic Average --period 300 --evaluation-periods 2 \
    --threshold 85 --comparison-operator GreaterThanThreshold \
    --treat-missing-data missing
echo "    memory high"

alarm "$APP_REGION" \
    --alarm-name portal-brasileirao-disk-high \
    --alarm-description "Root filesystem above 85%" \
    --namespace CWAgent --metric-name disk_used_percent \
    --dimensions "Name=InstanceId,Value=${INSTANCE_ID}" "Name=path,Value=/" \
    --statistic Average --period 300 --evaluation-periods 2 \
    --threshold 85 --comparison-operator GreaterThanThreshold \
    --treat-missing-data missing
echo "    disk high"

echo ""
echo "Done. Alarms:"
aws cloudwatch describe-alarms --region "$APP_REGION" \
    --alarm-name-prefix portal-brasileirao \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' --output table
aws cloudwatch describe-alarms --region "$GLOBAL_REGION" \
    --alarm-name-prefix portal-brasileirao \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' --output table
