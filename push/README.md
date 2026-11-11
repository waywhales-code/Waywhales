# COSMOS push notifications

This folder contains the source and database schema for the separate Cloudflare Worker used by COSMOS web push.

## Architecture

- The static PWA remains hosted on GitHub Pages.
- `sw.js` receives push events and displays notifications.
- The `cosmos-push` Worker stores browser subscriptions in the EU-jurisdiction D1 database and sends Web Push.
- A one-minute Cron Trigger checks each device's local timezone and reminder time.
- No diary entries, supplement names, health information, or profile data are sent to the push service. The first milestone sends one generic daily reminder.

## Cloudflare resources

The Worker is named `cosmos-push` and uses:
- D1 binding: `DB`
- Plain text variables: `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- Secret: `VAPID_PRIVATE_JWK`
- D1 table `vapid_tokens`: caches signed VAPID JWTs by push-provider audience so the server reuses tokens instead of creating one for each notification.
- Cron: `* * * * *`

The D1 database must have the schema in `schema.sql`.

**Never put the private VAPID JWK or any API secret in GitHub.** Keep it in Cloudflare Workers → Settings → Variables and Secrets as a Secret. The public key is returned by the Worker at `/config`; the PWA fetches it at runtime.

## API

- `GET /health` — service status
- `GET /config` — public VAPID key and configuration status
- `POST /subscribe` — save or update one device subscription
- `POST /unsubscribe` — remove one device subscription

VAPID JWTs are signed with the private key and stored with their expiry in D1. The private key itself is never stored in GitHub; it remains a Cloudflare Worker Secret.

The Worker only accepts browser-originated management requests from the GitHub Pages origin. Rate limiting is a lightweight pilot safeguard; persistent abuse controls should be added before a broad public launch.

## Platform notes

- iPhone: the PWA must be added to the Home Screen and opened from its icon; the browser must grant notification permission.
- Android: use a browser with Web Push and Service Worker support.
- Delivery depends on OS permissions, network connectivity, and push-provider behavior. The app cannot guarantee every notification will arrive at an exact minute.
