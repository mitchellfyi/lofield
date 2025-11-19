# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Lofield FM, please report it to us privately. Do not open a public issue.

**To report a security vulnerability:**
1. Email the project maintainers (contact information in README.md)
2. Include a description of the vulnerability
3. Include steps to reproduce (if applicable)
4. We'll respond within 48 hours with next steps

## Secure Configuration

### Environment Variables and Credentials

Lofield FM uses environment variables to manage sensitive credentials. **Never commit `.env` files to version control.**

#### Setting Up Secure Credentials

1. **Copy the example files:**
   ```bash
   make setup        # copies .env.docker -> .env and syncs web/ + services/
   ```
   If you cannot use `make`, copy `.env.docker → .env` manually and run `make env-sync` (or `cp .env web/.env` etc.) so every service shares the same values.

2. **Generate secure passwords:**
   ```bash
   # Linux/macOS
   openssl rand -base64 32
   
   # Or use your password manager
   ```

3. **Replace all placeholder values:**
   - `POSTGRES_PASSWORD`: Database password
   - `ICECAST_SOURCE_PASSWORD`: Password for streaming sources
   - `ICECAST_RELAY_PASSWORD`: Password for relay servers
   - `ICECAST_ADMIN_PASSWORD`: Admin interface password
   - Update `DATABASE_URL` in the root `.env` (and re-run `make env-sync`) so every service shares the same `POSTGRES_PASSWORD`

#### What NOT to Do

❌ **Don't commit secrets to Git:**
```bash
# This is already in .gitignore, but verify:
git status
# Should NOT show .env files
```

❌ **Don't use default passwords in production:**
```bash
# BAD - example passwords
POSTGRES_PASSWORD=password
ICECAST_SOURCE_PASSWORD=hackme

# GOOD - strong unique passwords
POSTGRES_PASSWORD=xK9mP2$vQw7nL4hR8tYu3zA6bJ1sC5fD
ICECAST_SOURCE_PASSWORD=aB3dE6fG9hJ2kL5mN8pQ1rS4tU7vW0xY
```

❌ **Don't share API keys or credentials in:**
- Git commits
- GitHub issues or pull requests
- Public documentation
- Log files (sanitize logs before sharing)
- Error messages shown to users

### Production Deployment Security

#### Database Security

1. **Use strong passwords** (minimum 32 characters, random)
2. **Restrict database access** to only the application server
3. **Enable SSL/TLS** for database connections:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   ```
4. **Regular backups** with encryption
5. **Keep PostgreSQL updated** to the latest stable version

#### API Security

1. **Rate Limiting**: Configure rate limiting in production
   ```bash
   # In web/.env
   RATE_LIMIT_PER_HOUR=100
   ```

2. **Content Moderation**: Enable auto-moderation
   ```bash
   AUTO_MODERATION_ENABLED="true"
   OPENAI_API_KEY="your-openai-key-here"
   ```

3. **HTTPS Only**: Use a reverse proxy (nginx, Caddy) with automatic HTTPS
4. **CORS Configuration**: Restrict API access to your domain only
5. **Input Validation**: Already implemented in API routes (max lengths, type checking)

#### Icecast Security

1. **Change default passwords** (covered in credential setup above)
2. **Restrict admin access** to localhost or VPN only:
   ```xml
   <admin>localhost</admin>
   ```
3. **Use strong authentication** for source clients
4. **Consider running behind a reverse proxy** with SSL termination

#### Environment Variables in Production

**For Docker deployments:**
```bash
# Use Docker secrets or environment variables
docker run --env-file .env ...
```

**For systemd services:**
```ini
[Service]
EnvironmentFile=/opt/lofield/.env
```

**For cloud platforms (Vercel, Railway, Render):**
- Use the platform's environment variable UI
- Never commit production `.env` files to the repository
- Use separate credentials for staging and production

### Dependency Security

1. **Regular updates**: Check for security updates weekly
   ```bash
   npm audit
   npm audit fix
   ```

2. **Automated scanning**: GitHub Dependabot is enabled for this repository

3. **Review dependencies**: Before adding new packages, check:
   - Package popularity and maintenance status
   - Security advisories
   - License compatibility

### API Key Security

When AI integration is implemented:

1. **Use environment variables** (already configured)
2. **Rotate keys regularly** (every 90 days recommended)
3. **Use least-privilege keys** (read-only when possible)
4. **Monitor usage** to detect unauthorized access
5. **Set spending limits** on AI API accounts

### Monitoring and Logging

1. **Log security events:**
   - Failed authentication attempts
   - Rate limit violations
   - Moderation rejections
   - Database connection errors

2. **Sanitize logs:**
   - Don't log passwords or API keys
   - Don't log sensitive user data
   - Hash or truncate IDs in logs

3. **Set up alerts:**
   - Database connection failures
   - Abnormal traffic patterns
   - High error rates
   - Service downtime

### Security Checklist for Production

Before deploying to production, verify:

- [ ] All `.env.example` placeholders replaced with secure values
- [ ] No `.env` files committed to Git
- [ ] Database uses strong password and SSL
- [ ] Icecast admin interface restricted to localhost/VPN
- [ ] HTTPS enabled via reverse proxy
- [ ] Rate limiting configured
- [ ] Auto-moderation enabled
- [ ] Regular backup system in place
- [ ] Monitoring and alerting configured
- [ ] Dependencies up to date (`npm audit` clean)
- [ ] API keys rotated from development defaults
- [ ] Error messages don't expose system details
- [ ] CORS properly configured
- [ ] File upload limits set (if applicable)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| develop | :x:                |
| < 1.0   | :x:                |

Currently in development phase. Security updates will be applied to the `main` branch.

## Security Best Practices for Contributors

1. **Never commit secrets** - use `.env.example` with placeholders
2. **Validate all inputs** - assume all user input is malicious
3. **Use parameterized queries** - Prisma handles this, but be careful with raw queries
4. **Keep dependencies updated** - run `npm audit` before submitting PRs
5. **Follow principle of least privilege** - only request permissions actually needed
6. **Sanitize error messages** - don't expose stack traces or system info to users
7. **Test security features** - include tests for input validation and error handling

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

---

*Security is a shared responsibility. Thank you for helping keep Lofield FM secure.*
