#!/bin/bash
# Shows the firewall's DNS mode, the allowed domains, and the names looked up
# since the firewall started that are outside them, most looked up first.
# Needs no privileges: it only reads what init-firewall.sh left readable.
set -euo pipefail

DNS_MODE_FILE=/etc/devcontainer-firewall/dns-mode
ACTIVE_DOMAINS_FILE=/run/devcontainer-firewall/allowed-domains
DNS_LOG=/var/log/devcontainer-firewall/dns.log

if [ ! -r "$ACTIVE_DOMAINS_FILE" ] || [ ! -r "$DNS_LOG" ]; then
    echo "The firewall has not started: $ACTIVE_DOMAINS_FILE or $DNS_LOG is missing. It starts with the container (init-firewall.sh)." >&2
    exit 1
fi

DNS_MODE="$(cat "$DNS_MODE_FILE")"
echo "DNS mode: $DNS_MODE"
echo
echo "Allowed domains, each with all its subdomains:"
sed 's/^/  /' "$ACTIVE_DOMAINS_FILE"
echo
if [ "$DNS_MODE" = "learn" ]; then
    echo "Looked up outside the allowed domains (they resolve, but connections to them are refused):"
else
    echo "Looked up outside the allowed domains (they did not resolve):"
fi

# dnsmasq logs each query as "... query[<type>] <name> from <address>".
OUTSIDE_NAMES="$(awk -v domains_file="$ACTIVE_DOMAINS_FILE" '
    function is_allowed(name,    dot) {
        while (name != "") {
            if (name in allowed) {
                return 1
            }
            dot = index(name, ".")
            if (dot == 0) {
                return 0
            }
            name = substr(name, dot + 1)
        }
        return 0
    }
    BEGIN {
        while ((getline domain < domains_file) > 0) {
            allowed[domain] = 1
        }
    }
    / query\[/ {
        for (field = 1; field < NF; field++) {
            if ($field ~ /^query\[/) {
                name = tolower($(field + 1))
                if (!is_allowed(name)) {
                    counts[name] += 1
                }
                break
            }
        }
    }
    END {
        for (name in counts) {
            printf "%7d  %s\n", counts[name], name
        }
    }
' "$DNS_LOG" | sort -rn)"

if [ -z "$OUTSIDE_NAMES" ]; then
    echo "  none"
else
    echo "$OUTSIDE_NAMES"
fi
