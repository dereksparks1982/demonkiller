#!/usr/bin/env bash
# Demon Killer for Linux. One game, local persistent world, no password.
root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
port="${DK_SERVER_PORT:-8766}"
if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  printf 'Invalid DK Server port: %s\n' "$port" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Demon Killer requires Node.js 20 or later.\n' >&2
  exit 1
fi
url="http://127.0.0.1:$port/"
log_dir="${XDG_STATE_HOME:-$HOME/.local/state}/demon-killer"
mkdir -p -m 700 "$log_dir" || exit 1
health() {
  DK_GAME_URL="$url" node -e '
    const timeout=AbortSignal.timeout(900);
    fetch(process.env.DK_GAME_URL+"api/v1/health",{signal:timeout})
      .then(async r=>{const x=await r.json(); if(!r.ok||x.name!=="DK Server")process.exit(2);
        if(x.build!=="local-m23")process.exit(3);})
      .catch(()=>process.exit(1));
  ' >/dev/null 2>&1
}
health
status=$?
if (( status == 3 )); then
  printf 'An older DK Server is running on port %s. Stop it first, then launch Demon Killer again.\n' "$port" >&2
  exit 1
elif (( status != 0 )); then
  nohup env DK_SERVER_PORT="$port" node "$root/server/dk-server.cjs" \
    >>"$log_dir/server.log" 2>&1 </dev/null &
  started=0
  for (( attempt=0; attempt<50; attempt++ )); do
    if health; then started=1;break;fi
    sleep .15
  done
  if (( started == 0 )); then
    printf 'Demon Killer could not start DK Server. Check %s/server.log\n' "$log_dir" >&2
    exit 1
  fi
fi
printf 'Demon Killer is running at %s\n' "$url"
printf 'Closing Firefox keeps the world running. Pause or resume it under Options.\n'
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url" >/dev/null 2>&1 &
else
  printf 'Open %s in your browser.\n' "$url"
fi
