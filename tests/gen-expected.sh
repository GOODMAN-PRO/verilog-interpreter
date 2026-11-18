#!/usr/bin/env bash
# All expected text comes directly from the local Icarus/vvp oracle.
set -euo pipefail
export LC_ALL=C

tests_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
iverilog="${IVERILOG:-/g/iverilog/bin/iverilog.exe}"
vvp="${VVP:-/g/iverilog/bin/vvp.exe}"
if [[ ! -x "$iverilog" ]]; then iverilog="${IVERILOG:-iverilog}"; fi
if [[ ! -x "$vvp" ]]; then vvp="${VVP:-vvp}"; fi
command -v "$iverilog" >/dev/null
command -v "$vvp" >/dev/null
scratch="$(mktemp -d "$tests_dir/.oracle.XXXXXXXX")"
cleanup() {
  rm -f -- "$scratch"/*
  rmdir -- "$scratch"
}
trap cleanup EXIT
shopt -s nullglob
cases=("$tests_dir"/cases/*.v)
if (( ${#cases[@]} == 0 )); then
  printf 'No Verilog cases found.\n' >&2
  exit 1
fi

for source in "${cases[@]}"; do
  name="$(basename -- "$source" .v)"
  if ! "$iverilog" -g2005 -o "$scratch/case.vvp" "$source" 2>"$scratch/compile.log"; then
    cat "$scratch/compile.log" >&2
    printf 'Compile failed: %s\n' "$name" >&2
    exit 1
  fi
  # The corpus is warning-free; diagnostics require review, even on exit 0.
  if [[ -s "$scratch/compile.log" ]]; then
    cat "$scratch/compile.log" >&2
    printf 'Unexpected compiler diagnostic: %s\n' "$name" >&2
    exit 1
  fi
  if ! "$vvp" -n "$scratch/case.vvp" >"$scratch/stdout" 2>"$scratch/runtime.log"; then
    cat "$scratch/runtime.log" >&2
    printf 'Simulation failed: %s\n' "$name" >&2
    exit 1
  fi
  if [[ -s "$scratch/runtime.log" ]]; then
    cat "$scratch/runtime.log" >&2
    printf 'Unexpected runtime diagnostic: %s\n' "$name" >&2
    exit 1
  fi
  # Remove only CR from CRLF line endings and the two specified diagnostic lines.
  # No whitespace trimming, field rewriting, or case-specific substitutions.
  sed -e 's/\r$//' -e '/\$finish called at/d' -e '/\$stop called at/d' \
    "$scratch/stdout" >"$scratch/$name.expected"
done

# Publish only after every case has successfully compiled and run.
for source in "${cases[@]}"; do
  name="$(basename -- "$source" .v)"
  cp -- "$scratch/$name.expected" "${source%.v}.expected"
done
printf 'Generated %d expected files from Icarus.\n' "${#cases[@]}"
