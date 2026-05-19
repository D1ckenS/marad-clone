# Apache Superset configuration for FleetOps development.
# Mounted into the container at /app/superset_config.py.

import os

# Use SQLite for dev; swap to PostgreSQL for production.
SQLALCHEMY_DATABASE_URI = "sqlite:////app/superset_home/superset.db"

SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "fleetops-superset-dev-secret-change-me")

# Enable the embedded analytics SDK.
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "ALERT_REPORTS": False,
}

# Allow the FleetOps frontend to embed dashboards.
ENABLE_CORS = True
CORS_OPTIONS = {
    "origins": [
        "http://localhost:5342",   # web-shore dev
        "http://localhost:3000",   # api-shore dev
    ],
    "supports_credentials": True,
}

# Disable CSRF for local dev (re-enable for production).
WTF_CSRF_ENABLED = False

# Guest-token TTL (seconds).
GUEST_TOKEN_JWT_EXP_SECONDS = 300

# Allow iFrame embedding from the FleetOps frontend.
HTTP_HEADERS = {}
TALISMAN_ENABLED = False
