# Flask + Keycloak

## Overview

Flask + `Authlib` (OAuth/OIDC client) combination.
Authlib is a universal OAuth library supporting Flask, Django, Starlette, and more.

`flask-oidc` is almost unmaintained — do not use.

## Required Packages

```bash
pip install flask authlib requests
```

## Environment Variables (.env)

```env
KEYCLOAK_URL=https://auth.company.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-flask-app
KEYCLOAK_CLIENT_SECRET=your-client-secret
FLASK_SECRET_KEY=your-flask-secret-key
```

## Generated Files

### 1. `config.py` — Config

```python
import os


class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "change-me")

    KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "https://auth.company.com")
    KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "my-realm")
    KEYCLOAK_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "my-flask-app")
    KEYCLOAK_CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET", "")

    @property
    def keycloak_issuer(self):
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"
```

### 2. `app.py` — Flask App

```python
import os
from functools import wraps

from authlib.integrations.flask_client import OAuth
from flask import Flask, redirect, session, url_for, render_template_string, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me")

# ── Keycloak OIDC Settings ──
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "https://auth.company.com")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "my-realm")
KEYCLOAK_ISSUER = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"

oauth = OAuth(app)
oauth.register(
    name="keycloak",
    client_id=os.environ.get("KEYCLOAK_CLIENT_ID", "my-flask-app"),
    client_secret=os.environ.get("KEYCLOAK_CLIENT_SECRET", ""),
    server_metadata_url=f"{KEYCLOAK_ISSUER}/.well-known/openid-configuration",
    client_kwargs={"scope": "openid profile email"},
)


# ── Auth Decorators ──
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = session.get("user")
        if not user:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def role_required(roles: list[str]):
    """Role-based access control decorator"""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = session.get("user")
            if not user:
                return redirect(url_for("login"))
            user_roles = user.get("realm_access", {}).get("roles", [])
            if not any(r in user_roles for r in roles):
                return jsonify({"error": "Access denied"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ── Routes ──
@app.route("/")
def home():
    user = session.get("user")
    if user:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/login")
def login():
    return render_template_string(LOGIN_TEMPLATE)


@app.route("/auth/login")
def auth_login():
    redirect_uri = url_for("auth_callback", _external=True)
    return oauth.keycloak.authorize_redirect(redirect_uri)


@app.route("/auth/callback")
def auth_callback():
    token = oauth.keycloak.authorize_access_token()
    userinfo = token.get("userinfo", {})

    session["user"] = userinfo
    session["access_token"] = token.get("access_token")
    session["refresh_token"] = token.get("refresh_token")
    session["id_token"] = token.get("id_token")

    return redirect(url_for("dashboard"))


@app.route("/dashboard")
@login_required
def dashboard():
    user = session["user"]
    return render_template_string(
        DASHBOARD_TEMPLATE,
        name=user.get("name", "Unknown"),
        email=user.get("email", "Unknown"),
        username=user.get("preferred_username", "Unknown"),
    )


@app.route("/logout")
def logout():
    id_token = session.get("id_token")
    session.clear()

    if id_token:
        logout_url = (
            f"{KEYCLOAK_ISSUER}/protocol/openid-connect/logout"
            f"?id_token_hint={id_token}"
            f"&post_logout_redirect_uri={url_for('login', _external=True)}"
        )
        return redirect(logout_url)

    return redirect(url_for("login"))


# ── RBAC Example ──
@app.route("/admin")
@role_required(["admin"])
def admin_page():
    return jsonify({"message": "Admin page", "user": session["user"]["preferred_username"]})


# ── Templates ──
LOGIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>Login</title>
<style>
body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
.card { max-width: 400px; width: 100%; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
h2 { color: #111827; }
p { color: #6b7280; }
.btn { display: block; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; text-decoration: none; }
.btn:hover { background: #1d4ed8; }
</style>
</head>
<body>
<div class="card">
    <h2>Login</h2>
    <p>Sign in with your company SSO account</p>
    <a href="/auth/login" class="btn">Sign in with SSO</a>
</div>
</body>
</html>
"""

DASHBOARD_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
<h1>Dashboard</h1>
<p>Name: {{ name }}</p>
<p>Email: {{ email }}</p>
<p>Username: {{ username }}</p>
<a href="/logout">Sign out</a>
</body>
</html>
"""

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### 3. API Only (JWT Verification)

When using Flask as API server only (separate frontend):

```python
from functools import wraps
from flask import Flask, request, jsonify
from jose import JWTError, jwt
from jwt import PyJWKClient

app = Flask(__name__)

KEYCLOAK_ISSUER = "https://auth.company.com/realms/my-realm"
KEYCLOAK_CLIENT_ID = "my-api"

jwks_client = PyJWKClient(f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs")


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401

        token = auth_header.split(" ")[1]
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=KEYCLOAK_CLIENT_ID,
                issuer=KEYCLOAK_ISSUER,
            )
            request.user = payload
        except JWTError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)
    return decorated


@app.route("/api/me")
@token_required
def api_me():
    return jsonify({
        "username": request.user.get("preferred_username"),
        "email": request.user.get("email"),
    })
```

## Keycloak Client Configuration

| Setting | Value |
|---------|-------|
| Client type | OpenID Connect |
| Client authentication | ON (confidential) |
| Standard flow | ON |
| Valid redirect URIs | `http://localhost:5000/auth/callback` |
| Post logout redirect URIs | `http://localhost:5000/login` |
| Web origins | `http://localhost:5000` |

## Troubleshooting

**"OAuthError: invalid_client"**
→ Verify Client Secret is correct

**Session not persisting**
→ Verify `app.secret_key` setting. Empty string breaks sessions

**"MismatchingStateError"**
→ Clear browser cookies and retry. Check HTTP/HTTPS mismatch

**Can I use flask-oidc?**
→ flask-oidc is nearly unmaintained. Use Authlib instead
