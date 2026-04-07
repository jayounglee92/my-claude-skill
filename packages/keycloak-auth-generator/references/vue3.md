# Vue 3 + Keycloak (Composition API)

## Overview

Vue 3 Composition API + `@josempgon/vue-keycloak` (keycloak-js wrapper) combination.
Client-side auth, so Client authentication must be OFF (public client).

Default recommendation is `@josempgon/vue-keycloak`. Only provide the raw `keycloak-js` pattern if the user explicitly requests it.

## Required Packages

```bash
npm install keycloak-js @josempgon/vue-keycloak
```

## Environment Variables (.env)

Vite-based, so `VITE_` prefix is required:

```env
VITE_KEYCLOAK_URL=https://auth.company.com
VITE_KEYCLOAK_REALM=my-realm
VITE_KEYCLOAK_CLIENT_ID=my-app
```

> Vue uses a public client — no Client Secret needed. Never put secrets in client-side code.

## Generated Files

### 1. `src/config/keycloak.ts` — Keycloak Config

```typescript
import type { KeycloakConfig, KeycloakInitOptions } from "keycloak-js";

export const keycloakConfig: KeycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

export const keycloakInitOptions: KeycloakInitOptions = {
  flow: "standard",
  checkLoginIframe: false,
  onLoad: "check-sso",
  silentCheckSsoRedirectUri:
    window.location.origin + "/silent-check-sso.html",
};
```

### 2. `src/main.ts` — App Entry Point

```typescript
import { createApp } from "vue";
import { vueKeycloak } from "@josempgon/vue-keycloak";
import App from "./App.vue";
import { initRouter } from "./router";
import { keycloakConfig, keycloakInitOptions } from "./config/keycloak";

const app = createApp(App);

// Initialize vue-keycloak before registering the router
// so Keycloak redirect params don't remain in the URL
(async () => {
  await vueKeycloak.install(app, {
    config: keycloakConfig,
    initOptions: keycloakInitOptions,
  });

  app.use(initRouter());
  app.mount("#app");
})();
```

### 3. `src/router/index.ts` — Router + Auth Guard

```typescript
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useKeycloak } from "@josempgon/vue-keycloak";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: { public: true },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/views/DashboardView.vue"),
  },
  // RBAC example: admin role required
  // {
  //   path: "/admin",
  //   name: "Admin",
  //   component: () => import("@/views/AdminView.vue"),
  //   meta: { roles: ["admin"] },
  // },
];

export function initRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  router.beforeEach((to, _from, next) => {
    // Public pages pass through
    if (to.meta.public) return next();

    const { isAuthenticated, keycloak } = useKeycloak();

    if (!isAuthenticated.value) {
      // Unauthenticated → redirect to Keycloak login
      keycloak.login({
        redirectUri: window.location.origin + to.fullPath,
      });
      return;
    }

    // RBAC: when specific roles are required
    if (to.meta.roles) {
      const requiredRoles = to.meta.roles as string[];
      const hasRole = requiredRoles.some((role) =>
        keycloak.hasRealmRole(role)
      );
      if (!hasRole) {
        return next({ name: "Home" }); // or 403 page
      }
    }

    next();
  });

  return router;
}
```

### 4. `src/composables/useAuth.ts` — Auth Helper (optional)

`useKeycloak` from `@josempgon/vue-keycloak` is sufficient on its own, but wrapping it provides convenience in your project:

```typescript
import { computed } from "vue";
import { useKeycloak, getToken } from "@josempgon/vue-keycloak";

export function useAuth() {
  const {
    isAuthenticated,
    isPending,
    hasFailed,
    username,
    token,
    decodedToken,
    roles,
    keycloak,
    hasRoles,
    hasResourceRoles,
  } = useKeycloak();

  function login(redirectPath?: string) {
    keycloak.login({
      redirectUri: window.location.origin + (redirectPath ?? "/dashboard"),
    });
  }

  function logout() {
    keycloak.logout({
      redirectUri: window.location.origin + "/",
    });
  }

  // Refresh token before API calls (auto-refresh 10s before expiry)
  async function getAccessToken(): Promise<string> {
    return await getToken(10);
  }

  const user = computed(() => {
    if (!decodedToken.value) return null;
    return {
      name: (decodedToken.value as any).name,
      email: (decodedToken.value as any).email,
      preferredUsername: (decodedToken.value as any).preferred_username,
    };
  });

  return {
    isAuthenticated,
    isPending,
    hasFailed,
    username,
    user,
    roles,
    token,
    login,
    logout,
    getAccessToken,
    hasRoles,
    hasResourceRoles,
  };
}
```

### 5. `src/views/LoginView.vue` — Login Page

```vue
<script setup lang="ts">
import { useAuth } from "@/composables/useAuth";

const { login, isPending } = useAuth();
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
      <div class="text-center">
        <h2 class="text-3xl font-bold text-gray-900">Login</h2>
        <p class="mt-2 text-sm text-gray-600">
          Sign in with your company SSO account
        </p>
      </div>
      <button
        @click="login()"
        :disabled="isPending"
        class="w-full py-3 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {{ isPending ? "Loading..." : "Sign in with SSO" }}
      </button>
    </div>
  </div>
</template>
```

### 6. `src/views/DashboardView.vue` — Dashboard (with logout)

```vue
<script setup lang="ts">
import { useAuth } from "@/composables/useAuth";

const { user, roles, logout } = useAuth();
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Dashboard</h1>
          <button
            @click="logout()"
            class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
        <div v-if="user" class="space-y-3">
          <p>
            <span class="font-medium text-gray-700">Name:</span>
            {{ user.name }}
          </p>
          <p>
            <span class="font-medium text-gray-700">Email:</span>
            {{ user.email }}
          </p>
          <p>
            <span class="font-medium text-gray-700">Roles:</span>
            {{ roles?.join(", ") || "None" }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 7. `public/silent-check-sso.html` — Silent SSO Check

```html
<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>
```

Required for `check-sso` mode to verify SSO status via iframe.

### 8. `src/plugins/axios.ts` — Auto-inject token for API calls (optional)

```typescript
import axios from "axios";
import { getToken } from "@josempgon/vue-keycloak";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await getToken(10); // refresh 10s before expiry
    config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // redirect to login on token refresh failure
    window.location.href = "/login";
  }
  return config;
});

export default api;
```

## `keycloak-js` Direct Usage Version

To use keycloak-js directly without a wrapper library:

```typescript
// src/plugins/keycloak.ts
import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

export default keycloak;
```

```typescript
// src/main.ts
import keycloak from "./plugins/keycloak";

keycloak
  .init({ onLoad: "login-required", checkLoginIframe: false })
  .then((authenticated) => {
    if (authenticated) {
      app.mount("#app");

      // Auto token refresh (checks every 10s, refreshes 30s before expiry)
      setInterval(() => {
        keycloak.updateToken(30).catch(() => keycloak.logout());
      }, 10000);
    }
  });
```

## Keycloak Client Configuration

| Setting | Value |
|---------|-------|
| Client type | OpenID Connect |
| Client authentication | **OFF** (public client) |
| Standard flow | ON |
| Valid redirect URIs | `http://localhost:5173/*` (Vite default port) |
| Web origins | `http://localhost:5173` |

## Troubleshooting

**"Failed to initialize adapter" error**
→ Verify Keycloak URL, Realm, and Client ID are correct
→ Verify Keycloak server is running

**"Refused to frame" error (silent check-sso)**
→ In Keycloak Admin → Realm Settings → Security Defenses → Content Security Policy, allow `frame-src`
→ Or set `checkLoginIframe: false`

**Token refresh failed**
→ `updateToken(30)` means "refresh 30s before expiry". Try increasing the value
→ Check Keycloak Realm Settings → Tokens for Access Token Lifespan

**CORS error**
→ Add `http://localhost:5173` to Web origins
