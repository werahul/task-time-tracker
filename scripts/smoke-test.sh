#!/usr/bin/env bash
# End-to-end smoke test of a running deployment, over HTTP with a cookie jar —
# the same requests a browser makes:
#
#   register → logout → login → /auth/me → create task → start timer →
#   active timer restored → stop → dashboard → refresh rotation →
#   CSRF/origin + error hygiene → logout → protected endpoint rejected
#
# Usage:
#   scripts/smoke-test.sh <api-base-url> <frontend-origin>
#   scripts/smoke-test.sh https://tracker.example.com/api/v1 https://tracker.example.com
#   scripts/smoke-test.sh http://localhost:5000/api/v1 http://localhost:3000
#
# In proxy mode, pass the web app's URL (…/api/v1 on the frontend origin) so the
# proxy is exercised too. Creates one throwaway user (e2e.<timestamp>@example.com).
# Requires bash, curl and node. Exit code 0 = all checks passed.
set -u
if [ $# -ne 2 ]; then
  sed -n '2,17p' "$0"
  exit 2
fi
BASE="${1%/}"
ORIGIN="${2%/}"
JAR="$(mktemp)"
EMAIL="e2e.$(date +%s)@example.com"
PASS=0; FAIL=0

req() { # method path [json] -> sets CODE, BODY, HDRS
  local method=$1 path=$2 data=${3:-}
  local hdr; hdr="$(mktemp)"
  if [ -n "$data" ]; then
    BODY=$(curl -s -D "$hdr" -o - -X "$method" -b "$JAR" -c "$JAR" -H "Origin: $ORIGIN" \
      -H "Content-Type: application/json" --data "$data" "$BASE$path")
  else
    BODY=$(curl -s -D "$hdr" -o - -X "$method" -b "$JAR" -c "$JAR" -H "Origin: $ORIGIN" "$BASE$path")
  fi
  CODE=$(head -1 "$hdr" | awk '{print $2}')
  HDRS=$(cat "$hdr"); rm -f "$hdr"
}
check() { # label expected-code [grep-pattern-in-body]
  local ok=1
  [ "$CODE" = "$2" ] || ok=0
  if [ -n "${3:-}" ] && ! grep -qE -- "$3" <<<"$BODY"; then ok=0; fi
  if [ $ok = 1 ]; then PASS=$((PASS+1)); echo "  ok   $1 ($CODE)";
  else FAIL=$((FAIL+1)); echo "  FAIL $1: got $CODE, body: ${BODY:0:200}"; fi
}
json() { node -e "const b=JSON.parse(process.argv[1]);console.log(eval('b.'+process.argv[2]))" "$BODY" "$1"; }

echo "Register"
req POST /auth/register "{\"name\":\"E2E Tester\",\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\"}"
check "register" 201 '"success":true'
echo "$HDRS" | grep -i '^set-cookie' | sed 's/=[^;]*;/=<redacted>;/' | sed 's/^/       /'
cookie_ok() { # every auth cookie is HttpOnly; Secure whenever the site is https
  grep -qi 'set-cookie: access_token=.*HttpOnly' <<<"$HDRS" || return 1
  grep -qi 'set-cookie: refresh_token=.*HttpOnly' <<<"$HDRS" || return 1
  grep -qi 'set-cookie: refresh_token=.*Path=/api/v1/auth' <<<"$HDRS" || return 1
  if [[ "$ORIGIN" == https://* ]]; then
    grep -qi 'set-cookie: access_token=.*Secure' <<<"$HDRS" || return 1
    grep -qi 'set-cookie: refresh_token=.*Secure' <<<"$HDRS" || return 1
  fi
}
if cookie_ok; then
  PASS=$((PASS+1)); echo "  ok   cookie flags (HttpOnly, Secure on https, refresh Path=/api/v1/auth)"
else
  FAIL=$((FAIL+1)); echo "  FAIL cookie flags"
fi

echo "Logout, then login"
req POST /auth/logout; check "logout" 200
req GET /auth/me; check "me after logout rejected" 401
req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"wrong-password-xx\"}"; check "wrong password rejected" 401 'INVALID_CREDENTIALS'
req POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"correct-horse-battery\"}"; check "login" 200
req GET /auth/me; check "GET /auth/me" 200 "$EMAIL"

echo "Task + timer"
req POST /tasks '{"title":"E2E: deploy check","description":"Created by the smoke test"}'; check "create task" 201
TASK=$(json data.task.id)
req POST "/tasks/$TASK/timer/start"; check "start timer" 201 '"stoppedAt":null'
req POST "/tasks/$TASK/timer/start"; check "second start rejected" 409 'ACTIVE_TIMER_EXISTS'
sleep 2
req GET /time-logs/active; check "active timer restored (browser refresh)" 200 "\"taskId\":\"$TASK\""
echo "       elapsedSeconds=$(json data.elapsedSeconds)"
req POST "/tasks/$TASK/timer/stop"; check "stop timer" 200
echo "       durationSeconds=$(json data.durationSeconds)"
req GET /time-logs/active; check "no active timer" 200 '"data":null'

echo "Dashboard"
req GET "/dashboard/daily-summary?timezone=UTC"; check "daily summary updated" 200 '"tasksWorkedOn":1'
echo "       totalTrackedSeconds=$(json data.totalTrackedSeconds)"
req GET "/dashboard/weekly-summary?timezone=UTC"; check "weekly summary" 200 '"tasksWorkedOn":1'

echo "Session rotation"
req POST /auth/refresh; check "refresh rotates session" 200
req GET /auth/me; check "me after refresh" 200

echo "Security"
BODY=$(curl -s -o - -w '\n%{http_code}' -X POST -b "$JAR" -H "Origin: https://evil.example" -H "Content-Type: application/json" --data '{"title":"x"}' "$BASE/tasks")
CODE=$(tail -1 <<<"$BODY"); BODY=$(head -n -1 <<<"$BODY"); check "foreign Origin rejected (CSRF)" 403 'FORBIDDEN_ORIGIN'
BODY=$(curl -s -o - -w '\n%{http_code}' -X POST -b "$JAR" -H "Origin: $ORIGIN" -H "Content-Type: application/json" --data '{bad json' "$BASE/tasks")
CODE=$(tail -1 <<<"$BODY"); BODY=$(head -n -1 <<<"$BODY"); check "malformed JSON → sanitized 400" 400 'INVALID_JSON'
grep -qiE 'stack|at .*\.js|prisma' <<<"$BODY" && { FAIL=$((FAIL+1)); echo "  FAIL error body leaks internals"; } || { PASS=$((PASS+1)); echo "  ok   no internals in error body"; }

echo "Logout"
req POST /auth/logout; check "logout" 200
req GET /tasks; check "protected endpoint rejected" 401
req POST /auth/refresh; check "old refresh token rejected" 401

rm -f "$JAR"
echo; echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" = 0 ]
