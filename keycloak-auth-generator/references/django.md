# Django + Keycloak

## Overview

Django + `mozilla-django-oidc` or `django-allauth` (OIDC provider) combination.

**Two approaches:**
1. **mozilla-django-oidc** (recommended) — Lightweight, follows Django standards. Built-in DRF support.
2. **django-allauth** — Best when you also need social login with other providers.

Default to Option 1. If the user needs social login, use Option 2.

## Required Packages

### Option 1 (mozilla-django-oidc)
```bash
pip install mozilla-django-oidc
```

### Option 2 (django-allauth)
```bash
pip install django-allauth
```

## Environment Variables (.env)

```env
KEYCLOAK_URL=https://auth.company.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-django-app
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

## Option 1: mozilla-django-oidc (recommended)

### Generated Files

#### 1. `settings.py` — Additional settings

```python
import os

INSTALLED_APPS = [
    # ... existing apps
    "django.contrib.auth",
    "mozilla_django_oidc",  # add after django.contrib.auth
]

MIDDLEWARE = [
    # ... existing middleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "mozilla_django_oidc.middleware.SessionRefresh",  # auto session refresh
]

AUTHENTICATION_BACKENDS = [
    "myapp.auth_backend.KeycloakOIDCAuthenticationBackend",
    "django.contrib.auth.backends.ModelBackend",  # fallback: regular login
]

# ── Keycloak OIDC Settings ──
KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "https://auth.company.com")
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "my-realm")

OIDC_RP_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID", "my-django-app")
OIDC_RP_CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET", "")

# Keycloak endpoints
_REALM_URL = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"
OIDC_OP_AUTHORIZATION_ENDPOINT = f"{_REALM_URL}/protocol/openid-connect/auth"
OIDC_OP_TOKEN_ENDPOINT = f"{_REALM_URL}/protocol/openid-connect/token"
OIDC_OP_USER_ENDPOINT = f"{_REALM_URL}/protocol/openid-connect/userinfo"
OIDC_OP_JWKS_ENDPOINT = f"{_REALM_URL}/protocol/openid-connect/certs"
OIDC_OP_LOGOUT_ENDPOINT = f"{_REALM_URL}/protocol/openid-connect/logout"

# Signing algorithm
OIDC_RP_SIGN_ALGO = "RS256"
OIDC_RP_IDP_SIGN_KEY = ""  # leave empty to use JWKS endpoint

# Auto-create users
OIDC_CREATE_USER = True

# Session refresh interval (seconds) — checks session validity with Keycloak at this interval
OIDC_RENEW_ID_TOKEN_EXPIRY_SECONDS = 300  # 5 minutes

# Redirect after login/logout
LOGIN_URL = "/oidc/authenticate/"
LOGIN_REDIRECT_URL = "/dashboard/"
LOGOUT_REDIRECT_URL = "/"
```

#### 2. `myapp/auth_backend.py` — Custom Auth Backend

```python
from mozilla_django_oidc.auth import OIDCAuthenticationBackend


class KeycloakOIDCAuthenticationBackend(OIDCAuthenticationBackend):
    """Custom Keycloak auth backend"""

    def create_user(self, claims):
        """Create Django user from Keycloak claims"""
        user = super().create_user(claims)
        user.username = claims.get("preferred_username", user.username)
        user.first_name = claims.get("given_name", "")
        user.last_name = claims.get("family_name", "")
        user.email = claims.get("email", "")
        user.save()
        return user

    def update_user(self, user, claims):
        """Sync user info on every login"""
        user.first_name = claims.get("given_name", user.first_name)
        user.last_name = claims.get("family_name", user.last_name)
        user.email = claims.get("email", user.email)
        user.save()
        return user

    def filter_users_by_claims(self, claims):
        """Match existing user by email"""
        email = claims.get("email")
        if not email:
            return self.UserModel.objects.none()
        return self.UserModel.objects.filter(email__iexact=email)
```

#### 3. `urls.py` — URL Config

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("oidc/", include("mozilla_django_oidc.urls")),  # OIDC endpoints
    path("", include("myapp.urls")),
]
```

#### 4. `myapp/urls.py` — App URLs

```python
from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("login/", views.login_page, name="login"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("logout/", views.logout_view, name="logout"),
]
```

#### 5. `myapp/views.py` — Views

```python
from django.contrib.auth import logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.conf import settings


def home(request):
    return render(request, "home.html")


def login_page(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return render(request, "login.html")


@login_required
def dashboard(request):
    return render(request, "dashboard.html")


def logout_view(request):
    # Also terminate Keycloak session
    id_token = request.session.get("oidc_id_token")
    logout(request)

    if id_token:
        keycloak_logout_url = (
            f"{settings.OIDC_OP_LOGOUT_ENDPOINT}"
            f"?id_token_hint={id_token}"
            f"&post_logout_redirect_uri={request.build_absolute_uri('/')}"
        )
        return redirect(keycloak_logout_url)

    return redirect("/")
```

#### 6. `templates/login.html` — Login Page

```html
<!DOCTYPE html>
<html>
<head>
    <title>Login</title>
    <style>
        body { font-family: sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { max-width: 400px; width: 100%; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        h2 { color: #111827; }
        p { color: #6b7280; }
        .btn { display: block; width: 100%; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; text-decoration: none; box-sizing: border-box; }
        .btn:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Login</h2>
        <p>Sign in with your company SSO account</p>
        <a href="{% url 'oidc_authentication_init' %}" class="btn">Sign in with SSO</a>
    </div>
</body>
</html>
```

#### 7. `templates/dashboard.html` — Dashboard

```html
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
    <h1>Dashboard</h1>
    <p>Name: {{ user.get_full_name }}</p>
    <p>Email: {{ user.email }}</p>
    <p>Username: {{ user.username }}</p>
    <a href="{% url 'logout' %}">Sign out</a>
</body>
</html>
```

## Option 2: django-allauth (OIDC)

django-allauth 0.56.0+ removed the dedicated Keycloak provider. Use the OpenID Connect provider instead.

### settings.py

```python
INSTALLED_APPS = [
    # ...
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.openid_connect",
]

MIDDLEWARE = [
    # ...
    "allauth.account.middleware.AccountMiddleware",
]

AUTHENTICATION_BACKENDS = [
    "allauth.account.auth_backends.AuthenticationBackend",
    "django.contrib.auth.backends.ModelBackend",
]

SOCIALACCOUNT_PROVIDERS = {
    "openid_connect": {
        "APPS": [
            {
                "provider_id": "keycloak",
                "name": "Keycloak",
                "client_id": os.environ.get("KEYCLOAK_CLIENT_ID"),
                "secret": os.environ.get("KEYCLOAK_CLIENT_SECRET"),
                "settings": {
                    "server_url": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/.well-known/openid-configuration",
                },
            }
        ]
    }
}
```

### urls.py

```python
urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
]
```

## Django REST Framework Integration

When using DRF, leverage mozilla-django-oidc built-in DRF support:

```python
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "mozilla_django_oidc.contrib.drf.OIDCAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
}

OIDC_DRF_AUTH_BACKEND = "myapp.auth_backend.KeycloakOIDCAuthenticationBackend"
```

```python
# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_me(request):
    return Response({
        "username": request.user.username,
        "email": request.user.email,
    })
```

## Keycloak Client Configuration

| Setting | Value |
|---------|-------|
| Client type | OpenID Connect |
| Client authentication | ON (confidential) |
| Standard flow | ON |
| Valid redirect URIs | `http://localhost:8000/oidc/callback/` (mozilla-django-oidc) |
|  | `http://localhost:8000/accounts/openid_connect/keycloak/login/callback/` (allauth) |
| Web origins | `http://localhost:8000` |

## Troubleshooting

**"Invalid redirect_uri"**
→ Add the exact callback URL to Keycloak Valid Redirect URIs

**Username created as email hash**
→ Verify `preferred_username` mapping in `auth_backend.py`

**"Userinfo signed response algorithm must be unsigned"**
→ Keycloak Client → Advanced Settings → set User Info Signed Response Algorithm to empty

**Session refresh not working**
→ Verify `SessionRefresh` middleware is placed after `AuthenticationMiddleware`
