#!/bin/bash
# ==============================================================
# Generate Android APK signing keystore
# Outputs stone.keystore and its base64-encoded content
# for use with GitHub Actions secret ANDROID_KEYSTORE_B64
# ==============================================================

set -e

KEYSTORE_FILE="stone.keystore"
KEY_ALIAS="upload"
KEY_VALIDITY="10000"
KEY_SIZE="2048"

echo "============================================"
echo " Android APK Signing Keystore Generator"
echo "============================================"
echo ""

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
  echo "Error: keytool not found. Please install a JDK first."
  echo "  Install: brew install openjdk@17"
  exit 1
fi

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
  echo "Warning: '$KEYSTORE_FILE' already exists."
  read -p "  Overwrite? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled."
    exit 0
  fi
  rm "$KEYSTORE_FILE"
fi

echo ""
echo "Enter the following details (press Enter to use defaults):"
echo ""

read -p "  Organizational Unit (OU) [android]: " OU
OU="${OU:-android}"

read -p "  Organization (O) [stone]: " O
O="${O:-stone}"

read -p "  City/Locality (L) [Shanghai]: " L
L="${L:-Shanghai}"

read -p "  State/Province (ST) [Shanghai]: " ST
ST="${ST:-Shanghai}"

read -p "  Country Code (C) [CN]: " C
C="${C:-CN}"

DN="CN=, OU=${OU}, O=${O}, L=${L}, ST=${ST}, C=${C}"

echo ""
echo "============================================"
echo " Ready to generate:"
echo "   File:      $KEYSTORE_FILE"
echo "   Alias:     $KEY_ALIAS"
echo "   Validity:  ${KEY_VALIDITY} days"
echo "   Key size:  ${KEY_SIZE} bit"
echo "   DN:        $DN"
echo "============================================"
echo ""

# Prompt for password (twice)
read -s -p "Enter keystore password: " KEYSTORE_PASSWORD
echo ""
read -s -p "Confirm keystore password: " KEYSTORE_PASSWORD_CONFIRM
echo ""

if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
  echo "Error: Passwords do not match!"
  exit 1
fi

if [ -z "$KEYSTORE_PASSWORD" ]; then
  echo "Error: Password cannot be empty!"
  exit 1
fi

echo ""

# Generate keystore
keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize "$KEY_SIZE" \
  -validity "$KEY_VALIDITY" \
  -dname "$DN" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEYSTORE_PASSWORD"

echo ""
echo "Keystore generated: $KEYSTORE_FILE"
echo ""

# ==============================================================
# Output base64 for GitHub Secrets
# ==============================================================
echo "============================================"
echo " GitHub Actions Secrets Configuration"
echo "============================================"
echo ""

BASE64=$(base64 -i "$KEYSTORE_FILE")

echo "Add the following secrets to your GitHub repository:"
echo ""
echo "──────────────────────────────────────────────"
echo "  Secret name: ANDROID_KEYSTORE_B64"
echo "──────────────────────────────────────────────"
echo "${BASE64}"
echo "──────────────────────────────────────────────"
echo ""
echo "  Secret name: KEYSTORE_PASSWORD"
echo "  Value:       ${KEYSTORE_PASSWORD}"
echo "──────────────────────────────────────────────"
echo ""
echo "Keep this password safe. If lost, you will not be able"
echo "to publish APK updates with the same signature."
echo ""

# macOS: copy base64 to clipboard automatically
if command -v pbcopy &> /dev/null; then
  echo -n "$BASE64" | pbcopy
  echo "base64 copied to clipboard (macOS)"
elif command -v xclip &> /dev/null; then
  echo -n "$BASE64" | xclip -selection clipboard
  echo "base64 copied to clipboard (Linux)"
fi
