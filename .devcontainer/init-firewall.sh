#!/bin/bash
# The dev container's firewall. Outgoing connections reach only the addresses
# of the allowed domains, each with all its subdomains. A local DNS server,
# dnsmasq, adds those addresses to the allowed set as programs look the names
# up, so addresses that change and names unknown in advance still work.
#
# Everything the script reads is part of the image and owned by root, so the
# container's user, and an AI running as that user, cannot change what is
# allowed while the container runs. Changing it takes a rebuild:
#   /etc/devcontainer-firewall/allowed-domains.txt  from .devcontainer/allowed-domains.txt
#   /etc/devcontainer-firewall/dns-mode             the FIREWALL_DNS_MODE build argument
#
# DNS modes:
#   learn    every name resolves, but connections still reach only the
#            allowed domains. `firewall-status` lists the names looked up
#            outside them.
#   enforce  names outside the allowed domains do not resolve.
#
# Running the script again applies the same configuration again. A program
# that cached an address before that must look it up again to reach it.
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

CONFIG_DIR=/etc/devcontainer-firewall
ALLOWED_DOMAINS_FILE="$CONFIG_DIR/allowed-domains.txt"
DNS_MODE_FILE="$CONFIG_DIR/dns-mode"
# The resolver Docker gave the container, kept for the runs after resolv.conf points to dnsmasq
UPSTREAM_DNS_FILE="$CONFIG_DIR/upstream-dns"
RUN_DIR=/run/devcontainer-firewall
DNSMASQ_CONF="$RUN_DIR/dnsmasq.conf"
# The allowed domains as applied, one per line, for firewall-status
ACTIVE_DOMAINS_FILE="$RUN_DIR/allowed-domains"
DNS_LOG_DIR=/var/log/devcontainer-firewall
DNS_LOG="$DNS_LOG_DIR/dns.log"
ALLOWED_SET=allowed-domains
DNSMASQ_USER=dnsmasq
DNSMASQ_GROUP=nogroup

DOMAIN_PATTERN='^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]([a-z0-9-]*[a-z0-9])?$'
IPV4_PATTERN='^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'

# Prints the allowed domains, one per line, lowercased, without comments.
read_allowed_domains() {
    local line_number=0
    local line
    local -a words
    while IFS= read -r line || [ -n "$line" ]; do
        line_number=$((line_number + 1))
        IFS=$' \t\r' read -r -a words <<< "${line%%#*}"
        if [ "${#words[@]}" -eq 0 ]; then
            continue
        fi
        if [ "${#words[@]}" -gt 1 ] || [[ ! "${words[0],,}" =~ $DOMAIN_PATTERN ]]; then
            echo "ERROR: Line $line_number of $ALLOWED_DOMAINS_FILE is not one domain: \"$line\"" >&2
            exit 1
        fi
        echo "${words[0],,}"
    done < "$ALLOWED_DOMAINS_FILE"
}

read_dns_mode() {
    local mode
    mode="$(cat "$DNS_MODE_FILE")"
    if [ "$mode" != "learn" ] && [ "$mode" != "enforce" ]; then
        echo "ERROR: Unknown DNS mode \"$mode\" in $DNS_MODE_FILE: the FIREWALL_DNS_MODE build argument must be learn or enforce" >&2
        exit 1
    fi
    echo "$mode"
}

# The resolver Docker configured, or, once resolv.conf points to dnsmasq, the
# one an earlier run kept.
read_upstream_dns() {
    local nameserver
    nameserver="$(awk '$1 == "nameserver" && $2 != "127.0.0.1" { print $2; exit }' /etc/resolv.conf)"
    if [ -z "$nameserver" ] && [ -f "$UPSTREAM_DNS_FILE" ]; then
        nameserver="$(cat "$UPSTREAM_DNS_FILE")"
    fi
    if [[ ! "$nameserver" =~ $IPV4_PATTERN ]]; then
        echo "ERROR: No IPv4 resolver for dnsmasq in /etc/resolv.conf or $UPSTREAM_DNS_FILE (found \"$nameserver\")" >&2
        exit 1
    fi
    echo "$nameserver"
}

# Docker gives this container no IPv6 today. If it ever does, IPv6 is blocked
# but for loopback. Without ip6tables, only a container without a global IPv6
# address may go on.
block_ipv6() {
    if ip6tables -P OUTPUT DROP 2>/dev/null; then
        ip6tables -P INPUT DROP
        ip6tables -P FORWARD DROP
        ip6tables -F
        ip6tables -A INPUT -i lo -j ACCEPT
        ip6tables -A OUTPUT -o lo -j ACCEPT
        return
    fi
    local global_addresses
    global_addresses="$(ip -6 addr show scope global 2>/dev/null || true)"
    if [[ "$global_addresses" == *inet6* ]]; then
        echo "ERROR: ip6tables is unavailable and the container has a global IPv6 address, which the firewall cannot block" >&2
        exit 1
    fi
    echo "ip6tables is unavailable; the container has no global IPv6 address to block"
}

# Stops the dnsmasq of an earlier run, before its ipset is destroyed.
stop_dnsmasq() {
    local attempts=0
    pkill -x dnsmasq || true
    while pgrep -x dnsmasq >/dev/null; do
        attempts=$((attempts + 1))
        if [ "$attempts" -gt 50 ]; then
            echo "ERROR: The dnsmasq of an earlier run did not stop" >&2
            exit 1
        fi
        sleep 0.1
    done
}

# Forwards the allowed domains to the upstream resolver and adds their
# addresses to the allowed set. Other names are forwarded too in learn mode,
# and get no address in enforce mode.
write_dnsmasq_conf() {
    local mode="$1"
    local upstream="$2"
    local domain
    local dnsmasq_help
    dnsmasq_help="$(dnsmasq --help)"
    {
        echo "# Written by init-firewall.sh"
        echo "listen-address=127.0.0.1"
        echo "bind-interfaces"
        echo "user=$DNSMASQ_USER"
        echo "group=$DNSMASQ_GROUP"
        echo "pid-file=$RUN_DIR/dnsmasq.pid"
        echo "no-resolv"
        echo "no-hosts"
        echo "cache-size=1000"
        echo "log-queries"
        echo "log-facility=$DNS_LOG"
        # The container has no IPv6, so programs need not try IPv6 addresses first
        if [[ "$dnsmasq_help" == *--filter-AAAA* ]]; then
            echo "filter-AAAA"
        fi
        for domain in "${ALLOWED_DOMAINS[@]}"; do
            echo "server=/$domain/$upstream"
            echo "ipset=/$domain/$ALLOWED_SET"
        done
        if [ "$mode" = "learn" ]; then
            echo "server=$upstream"
        else
            echo "address=/#/"
        fi
    } > "$DNSMASQ_CONF"
}

start_dnsmasq() {
    install -d -m 0755 "$DNS_LOG_DIR"
    # Emptied at each run. dnsmasq writes it as its own user, and the container's user reads it.
    install -m 0644 -o "$DNSMASQ_USER" -g "$DNSMASQ_GROUP" /dev/null "$DNS_LOG"
    dnsmasq --test --conf-file="$DNSMASQ_CONF"
    dnsmasq --conf-file="$DNSMASQ_CONF"
    echo "nameserver 127.0.0.1" > /etc/resolv.conf
}

DNS_MODE="$(read_dns_mode)"
ALLOWED_DOMAINS_TEXT="$(read_allowed_domains)"
if [ -z "$ALLOWED_DOMAINS_TEXT" ]; then
    echo "ERROR: $ALLOWED_DOMAINS_FILE lists no domain" >&2
    exit 1
fi
mapfile -t ALLOWED_DOMAINS <<< "$ALLOWED_DOMAINS_TEXT"
UPSTREAM_DNS="$(read_upstream_dns)"
echo "DNS mode $DNS_MODE, upstream resolver $UPSTREAM_DNS, ${#ALLOWED_DOMAINS[@]} allowed domains"

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# 2. Block everything first, so the container stays closed while the rules are
# rebuilt and after any failure
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
block_ipv6
stop_dnsmasq

iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy "$ALLOWED_SET" 2>/dev/null || true

# 3. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# 4. Only dnsmasq may reach the upstream resolver, so every lookup goes through
# it. First, because the upstream can be Docker's resolver on loopback.
iptables -A OUTPUT -d "$UPSTREAM_DNS" -m owner ! --uid-owner "$DNSMASQ_USER" -j REJECT
# Loopback: dnsmasq, the dev servers and VS Code's port forwarding
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
# Replies to the allowed connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -p udp -d "$UPSTREAM_DNS" --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp -d "$UPSTREAM_DNS" --dport 53 -j ACCEPT

# 5. The allowed domains, whose addresses dnsmasq adds as they are looked up
ipset create "$ALLOWED_SET" hash:ip
iptables -A OUTPUT -m set --match-set "$ALLOWED_SET" dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# 6. dnsmasq, then resolv.conf points to it
install -d -m 0755 "$RUN_DIR"
printf '%s\n' "${ALLOWED_DOMAINS[@]}" > "$ACTIVE_DOMAINS_FILE"
chmod 0644 "$ACTIVE_DOMAINS_FILE"
echo "$UPSTREAM_DNS" > "$UPSTREAM_DNS_FILE"
write_dnsmasq_conf "$DNS_MODE" "$UPSTREAM_DNS"
start_dnsmasq

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
fi
echo "Firewall verification passed - unable to reach https://example.com as expected"

if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
fi
echo "Firewall verification passed - able to reach https://api.github.com as expected"

for resolver in "$UPSTREAM_DNS" 8.8.8.8; do
    if dig +time=2 +tries=1 "@$resolver" example.com >/dev/null 2>&1; then
        echo "ERROR: Firewall verification failed - a lookup skipped dnsmasq and reached $resolver"
        exit 1
    fi
done
echo "Firewall verification passed - lookups cannot skip dnsmasq"

if [ "$DNS_MODE" = "enforce" ]; then
    if getent hosts example.com >/dev/null; then
        echo "ERROR: Firewall verification failed - example.com resolves in enforce mode"
        exit 1
    fi
    echo "Firewall verification passed - names outside the allowed domains do not resolve"
fi
