#!/usr/bin/env bash
# External TLS check of the public hostnames (audit TLS-01, 2026-11-18). Read-only: a handful of handshakes and one
# HEAD request per hostname, no scanning.
#
#   scripts/verify-tls.sh [host ...]        (default: ai-commercestudio.com www.ai-commercestudio.com)
#
# Policy (what the visitor-facing edge must do):
#   TLS 1.0 and TLS 1.1 rejected; TLS 1.2 and TLS 1.3 accepted; certificate trusted and valid for at least
#   MIN_CERT_DAYS more days (default 21); HSTS with max-age >= 15552000.
#
# Exit codes: 0 policy met, 1 policy violated, 2 inconclusive (the local client could not even try, or the
# network failed). A legacy handshake that the *local* OpenSSL refuses to attempt is reported as INCONCLUSIVE,
# never as "rejected": a failed handshake from one client is not proof about the server.
set -u

HOSTS=("$@")
[ ${#HOSTS[@]} -eq 0 ] && HOSTS=(ai-commercestudio.com www.ai-commercestudio.com)
MIN_CERT_DAYS=${MIN_CERT_DAYS:-21}
TIMEOUT=${TIMEOUT:-15}

violations=0
inconclusive=0

handshake() { # host, openssl version flag -> prints the raw s_client output
  echo | timeout "$TIMEOUT" openssl s_client -connect "$1:443" -servername "$1" "-$2" -cipher 'ALL:@SECLEVEL=0' 2>&1
}

classify() { # raw output -> ACCEPTED | REJECTED | INCONCLUSIVE
  local out="$1"
  # The version flag pins the exact version, so a completed handshake means the server accepts it. The only reliable
  # sign of completion is a real cipher in "New, <proto>, Cipher is <cipher>": after a refusal OpenSSL still prints a
  # "Protocol" line with the version the client asked for, and "(NONE)" as the cipher.
  if printf '%s' "$out" | grep -Eq '^New, .*Cipher is [A-Za-z0-9_-]+' && ! printf '%s' "$out" | grep -q 'Cipher is (NONE)'; then echo ACCEPTED; return; fi
  if printf '%s' "$out" | grep -Eqi 'no protocols available|unsupported protocol|unknown option|invalid command|unable to set|bad record mac'; then echo INCONCLUSIVE; return; fi
  if printf '%s' "$out" | grep -Eqi 'getaddrinfo|connect:errno|timed out|connection refused|no route|network is unreachable'; then echo INCONCLUSIVE; return; fi
  if printf '%s' "$out" | grep -Eqi 'alert protocol version|alert handshake failure|alert number (70|40)|unexpected eof|connection reset|errno=104|wrong version number|no ciphers available'; then echo REJECTED; return; fi
  echo INCONCLUSIVE
}

report() { printf '  %-34s %s\n' "$1" "$2"; }

for host in "${HOSTS[@]}"; do
  echo "== $host"
  for spec in "tls1:TLSv1:1.0:reject" "tls1_1:TLSv1.1:1.1:reject" "tls1_2:TLSv1.2:1.2:accept" "tls1_3:TLSv1.3:1.3:accept"; do
    IFS=: read -r flag label name want <<<"$spec"
    out=$(handshake "$host" "$flag")
    got=$(classify "$out" "$label")
    verdict="ok"
    if [ "$got" = INCONCLUSIVE ]; then verdict="INCONCLUSIVE"; inconclusive=$((inconclusive + 1))
    elif [ "$want" = reject ] && [ "$got" = ACCEPTED ]; then verdict="VIOLATION (obsolete protocol accepted)"; violations=$((violations + 1))
    elif [ "$want" = accept ] && [ "$got" != ACCEPTED ]; then verdict="VIOLATION (required protocol not accepted)"; violations=$((violations + 1))
    fi
    report "TLS $name ($want)" "$got -> $verdict"
    sleep 1
  done

  # Certificate: trusted, not expiring soon (from a TLS 1.3 handshake).
  out=$(echo | timeout "$TIMEOUT" openssl s_client -connect "$host:443" -servername "$host" -verify_hostname "$host" 2>&1)
  if printf '%s' "$out" | grep -q 'Verify return code: 0 (ok)'; then report "certificate trusted, name matches" "ok"
  else report "certificate trusted, name matches" "VIOLATION or INCONCLUSIVE: $(printf '%s' "$out" | grep -m1 'Verify return code' || echo 'no certificate')"; violations=$((violations + 1)); fi
  end=$(printf '%s' "$out" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$end" ]; then
    if printf '%s' "$out" | openssl x509 -noout -checkend $((MIN_CERT_DAYS * 86400)) >/dev/null 2>&1; then report "certificate valid > ${MIN_CERT_DAYS} days" "ok (expires $end)"
    else report "certificate valid > ${MIN_CERT_DAYS} days" "VIOLATION (expires $end)"; violations=$((violations + 1)); fi
  else report "certificate expiry" "INCONCLUSIVE"; inconclusive=$((inconclusive + 1)); fi

  # HTTP: status, redirect target and HSTS.
  head=$(curl -sSI --max-time "$TIMEOUT" -A "acs-tls-check" "https://$host/" 2>&1 | tr -d '\r')
  status=$(printf '%s' "$head" | awk 'NR==1{print $2}')
  hsts=$(printf '%s' "$head" | awk 'tolower($1)=="strict-transport-security:"{print $2}' | head -1)
  if [ -z "$status" ]; then report "HTTPS answer" "INCONCLUSIVE"; inconclusive=$((inconclusive + 1))
  else
    report "HTTPS answer" "HTTP $status"
    age=$(printf '%s' "$hsts" | sed -n 's/.*max-age=\([0-9]*\).*/\1/p')
    if [ -n "$age" ] && [ "$age" -ge 15552000 ]; then report "HSTS" "ok (max-age=$age)"
    else report "HSTS" "VIOLATION (missing or short: '${hsts:-none}')"; violations=$((violations + 1)); fi
  fi
  sleep 1
done

echo
if [ "$violations" -gt 0 ]; then echo "RESULT: $violations violation(s)"; exit 1; fi
if [ "$inconclusive" -gt 0 ]; then echo "RESULT: no violation found, but $inconclusive check(s) were inconclusive (not a pass)"; exit 2; fi
echo "RESULT: TLS policy met"
exit 0
