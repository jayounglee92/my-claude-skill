# Next.js + Keycloak (Auth.js v5)

## Overview

Next.js App Router + Auth.js v5 (NextAuth) + Keycloak Provider combination.
Server-side auth, so Client authentication must be ON (confidential client).

## Required Packages

```bash
npm install next-auth@beta
```

> Auth.js v5 is installed as `next-auth@beta`. After stable release, use `next-auth`.

## Environment Variables (.env.local)

```env
# Keycloak
KEYCLOAK_URL=https://auth.company.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-app
KEYCLOAK_CLIENT_SECRET=your-client-secret

# Auth.js
AUTH_SECRET=                    # generate with: npx auth secret
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

Auth.js v5 auto-recognizes `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET`, `AUTH_KEYCLOAK_ISSUER`, so you can omit values in provider code:

```env
AUTH_KEYCLOAK_ID=my-app
AUTH_KEYCLOAK_SECRET=your-client-secret
AUTH_KEYCLOAK_ISSUER=https://auth.company.com/realms/my-realm
```

## Generated Files

### 1. `src/auth.ts` — Auth.js Config (core)

```typescript
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { JWT } from "next-auth/jwt";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      idToken: refreshedTokens.id_token ?? token.idToken,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial login: save token info from account
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: (account.expires_at ?? 0) * 1000,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
        };
      }

      // Token still valid — return as-is
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Expired — refresh
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  events: {
    // Fully terminate Keycloak session (federated logout)
    async signOut(message) {
      if ("token" in message) {
        const idToken = message.token?.idToken;
        if (idToken) {
          const logoutUrl = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/logout?id_token_hint=${idToken}`;
          await fetch(logoutUrl);
        }
      }
    },
  },
});
```

### 2. `src/app/api/auth/[...nextauth]/route.ts` — API Route

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### 3. `src/middleware.ts` — Auth Middleware

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname === "/login";

  // Public paths — customize for your project
  const publicPaths = ["/", "/about", "/api/auth"];
  const isPublicPath = publicPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (!isLoggedIn && !isPublicPath && !isOnLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isLoggedIn && isOnLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 4. `src/app/login/page.tsx` — Login Page

```tsx
import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Login</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with your company SSO account
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Sign in with SSO
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 5. `src/app/dashboard/page.tsx` — Dashboard (with logout)

```tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.error === "RefreshAccessTokenError") redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="space-y-3">
            <p>
              <span className="font-medium text-gray-700">Name:</span>{" "}
              {session.user?.name ?? "Unknown"}
            </p>
            <p>
              <span className="font-medium text-gray-700">Email:</span>{" "}
              {session.user?.email ?? "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6. `src/types/next-auth.d.ts` — Type Extensions

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    idToken?: string;
    error?: string;
  }
}
```

## Adding RBAC (Role-Based Access Control)

When the user requests RBAC, add role extraction to the jwt callback in `auth.ts`:

```typescript
// Inside jwt callback
async jwt({ token, account, profile }) {
  if (account) {
    // Extract roles from Keycloak token
    const accessTokenParsed = JSON.parse(
      Buffer.from(account.access_token!.split(".")[1], "base64").toString()
    );
    token.roles = accessTokenParsed.realm_access?.roles ?? [];
  }
  // ... existing logic
},

async session({ session, token }) {
  session.roles = token.roles as string[];
  // ... existing logic
},
```

Add to types:

```typescript
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    roles?: string[];
  }
}
```

Check roles in middleware:

```typescript
// Specific path requires role
if (req.nextUrl.pathname.startsWith("/admin")) {
  const session = req.auth;
  const roles = (session as any)?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl.origin));
  }
}
```

## Keycloak Client Configuration

| Setting | Value |
|---------|-------|
| Client type | OpenID Connect |
| Client authentication | ON |
| Valid redirect URIs | `http://localhost:3000/api/auth/callback/keycloak` (dev) |
| Web origins | `http://localhost:3000` |
| Post logout redirect URIs | `http://localhost:3000` |

## Troubleshooting

**"Invalid redirect_uri" error**
→ Add `http://localhost:3000/*` to Valid Redirect URIs in Keycloak Admin Console

**"CORS error"**
→ Add `http://localhost:3000` to Web origins, or enter `+`

**Token refresh failed**
→ Verify Client Secret. Check Realm Settings → Tokens for Refresh Token lifespan

**AUTH_SECRET not set**
→ Run `npx auth secret`, then add to `.env.local`
