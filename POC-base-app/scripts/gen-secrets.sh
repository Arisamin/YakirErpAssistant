#!/usr/bin/env bash
# יצירת סודות אקראיים חזקים ל-JWT. הרץ:  bash scripts/gen-secrets.sh
# העתק את הפלט אל משתני הסביבה אצל ספק האירוח (לא למאגר Git!).
set -euo pipefail
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
