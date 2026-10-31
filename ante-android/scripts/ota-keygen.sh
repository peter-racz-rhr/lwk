#!/usr/bin/env bash
# Makes a new update-signing key. Put the PUBLIC line into PUBLIC_KEY in Ota.kt (then rebuild the
# app once), and the PRIVATE file's contents into the GitHub secret ANTE_OTA_KEY. Never commit the private key.
set -euo pipefail
umask 077
openssl ecparam -name prime256v1 -genkey -noout -out ante-ota-private.pem
echo "PUBLIC (for Ota.kt):"
openssl ec -in ante-ota-private.pem -pubout -outform DER 2>/dev/null | base64 -w0; echo
echo "PRIVATE key written to ./ante-ota-private.pem"
