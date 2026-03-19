# Spring Boot + Thymeleaf + Keycloak

## Overview

Spring Boot + Spring Security OAuth2 Client + Thymeleaf combination.
Uses `spring-boot-starter-oauth2-client`. Does not use a separate Keycloak adapter.
(Keycloak's `keycloak-spring-boot-starter` is deprecated.)

## Required Dependencies

### Gradle (build.gradle.kts)

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
    implementation("org.thymeleaf.extras:thymeleaf-extras-springsecurity6")
}
```

### Maven (pom.xml)

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-oauth2-client</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-thymeleaf</artifactId>
    </dependency>
    <dependency>
        <groupId>org.thymeleaf.extras</groupId>
        <artifactId>thymeleaf-extras-springsecurity6</artifactId>
    </dependency>
</dependencies>
```

## Configuration Files

### application.yml

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          keycloak:
            client-id: ${KEYCLOAK_CLIENT_ID:my-app}
            client-secret: ${KEYCLOAK_CLIENT_SECRET}
            scope: openid,profile,email
            authorization-grant-type: authorization_code
            redirect-uri: "{baseUrl}/login/oauth2/code/{registrationId}"
        provider:
          keycloak:
            issuer-uri: ${KEYCLOAK_URL:https://auth.company.com}/realms/${KEYCLOAK_REALM:my-realm}
            user-name-attribute: preferred_username

server:
  port: 8080
```

Inject values via environment variables or `application-local.yml`.

## Generated Files

### 1. SecurityConfig.java — Spring Security Config

```java
package com.example.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.authority.mapping.GrantedAuthoritiesMapper;
import org.springframework.security.oauth2.core.oidc.user.OidcUserAuthority;
import org.springframework.security.web.SecurityFilterChain;

import java.util.*;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/login", "/css/**", "/js/**", "/images/**").permitAll()
                // RBAC example:
                // .requestMatchers("/admin/**").hasRole("admin")
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard", true)
                .userInfoEndpoint(userInfo -> userInfo
                    .userAuthoritiesMapper(keycloakAuthoritiesMapper())
                )
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/")
                .invalidateHttpSession(true)
                .clearAuthentication(true)
                .deleteCookies("JSESSIONID")
            );

        return http.build();
    }

    // Map Keycloak roles to Spring Security authorities
    private GrantedAuthoritiesMapper keycloakAuthoritiesMapper() {
        return authorities -> {
            Set<GrantedAuthority> mappedAuthorities = new HashSet<>();

            authorities.forEach(authority -> {
                if (authority instanceof OidcUserAuthority oidcAuth) {
                    // Extract roles from realm_access.roles
                    var realmAccess = oidcAuth.getIdToken().getClaim("realm_access");
                    if (realmAccess instanceof Map) {
                        var roles = (List<String>) ((Map<?, ?>) realmAccess).get("roles");
                        if (roles != null) {
                            mappedAuthorities.addAll(
                                roles.stream()
                                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                                    .collect(Collectors.toList())
                            );
                        }
                    }
                }
                mappedAuthorities.add(authority);
            });

            return mappedAuthorities;
        };
    }
}
```

### 2. KeycloakLogoutHandler.java — Keycloak Session Logout

```java
package com.example.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;

@Component
public class KeycloakLogoutHandler implements LogoutHandler {

    @Value("${spring.security.oauth2.client.provider.keycloak.issuer-uri}")
    private String issuerUri;

    @Override
    public void logout(HttpServletRequest request,
                       HttpServletResponse response,
                       Authentication authentication) {
        if (authentication != null
                && authentication.getPrincipal() instanceof OidcUser oidcUser) {
            String idToken = oidcUser.getIdToken().getTokenValue();
            String logoutUrl = issuerUri
                + "/protocol/openid-connect/logout"
                + "?id_token_hint=" + idToken
                + "&post_logout_redirect_uri=" + request.getScheme()
                + "://" + request.getServerName()
                + ":" + request.getServerPort() + "/";

            try {
                response.sendRedirect(logoutUrl);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
```

Add the handler to SecurityConfig:

```java
// Modify SecurityConfig.java logout section
@Bean
public SecurityFilterChain filterChain(HttpSecurity http,
        KeycloakLogoutHandler keycloakLogoutHandler) throws Exception {
    http
        // ... existing config
        .logout(logout -> logout
            .logoutUrl("/logout")
            .addLogoutHandler(keycloakLogoutHandler)
            .invalidateHttpSession(true)
            .clearAuthentication(true)
            .deleteCookies("JSESSIONID")
        );
    // ...
}
```

### 3. templates/login.html — Login Page

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; background: #f9fafb; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { max-width: 400px; width: 100%; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        h2 { font-size: 1.875rem; color: #111827; margin-bottom: 0.5rem; }
        p { color: #6b7280; font-size: 0.875rem; margin-bottom: 2rem; }
        .btn { display: block; width: 100%; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.875rem; cursor: pointer; text-decoration: none; }
        .btn:hover { background: #1d4ed8; }
        .error { color: #dc2626; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Login</h2>
        <p>Sign in with your company SSO account</p>
        <div th:if="${param.error}" class="error">
            Login failed. Please try again.
        </div>
        <a th:href="@{/oauth2/authorization/keycloak}" class="btn">
            Sign in with SSO
        </a>
    </div>
</body>
</html>
```

### 4. templates/dashboard.html — Dashboard

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org"
      xmlns:sec="http://www.thymeleaf.org/extras/spring-security">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; background: #f9fafb; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        h1 { font-size: 1.5rem; }
        .btn-logout { padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-size: 0.875rem; }
        .btn-logout:hover { background: #dc2626; }
        .info p { margin-bottom: 0.75rem; }
        .label { font-weight: 600; color: #374151; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>Dashboard</h1>
                <form th:action="@{/logout}" method="post">
                    <button type="submit" class="btn-logout">Sign out</button>
                </form>
            </div>
            <div class="info" sec:authorize="isAuthenticated()">
                <p><span class="label">Name:</span>
                    <span sec:authentication="principal.fullName">-</span></p>
                <p><span class="label">Email:</span>
                    <span sec:authentication="principal.email">-</span></p>
                <p><span class="label">Username:</span>
                    <span sec:authentication="principal.preferredUsername">-</span></p>
            </div>

            <!-- RBAC example -->
            <div sec:authorize="hasRole('admin')">
                <h3>Admin Menu</h3>
                <p>This section is only visible to admins.</p>
            </div>
        </div>
    </div>
</body>
</html>
```

### 5. MainController.java — Controller

```java
package com.example.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class MainController {

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/dashboard")
    public String dashboard() {
        return "dashboard";
    }

    @GetMapping("/")
    public String home() {
        return "login";
    }
}
```

## Keycloak Client Configuration

| Setting | Value |
|---------|-------|
| Client type | OpenID Connect |
| Client authentication | ON (confidential) |
| Standard flow | ON |
| Valid redirect URIs | `http://localhost:8080/login/oauth2/code/keycloak` |
| Post logout redirect URIs | `http://localhost:8080/` |
| Web origins | `http://localhost:8080` |

## Troubleshooting

**"Unable to resolve the Issuer" error**
→ Verify `issuer-uri` is correct. Must include `/realms/realm-name`
→ Verify Keycloak server is accessible

**CSRF token error**
→ Using `th:action` in logout form auto-inserts CSRF token via Thymeleaf

**Role mapping not working**
→ In Keycloak, Client Scopes → roles → Mappers, verify "realm roles" is included in the token
→ Verify `keycloakAuthoritiesMapper` in SecurityConfig is applied

**Can I use "keycloak-spring-boot-starter"?**
→ No. It is deprecated. Use `spring-boot-starter-oauth2-client` instead
