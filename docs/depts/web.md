# 🌐 Web App Office

## Universal Web Strategy

- **Route logic:** Uses the shared `app/(tabs)` routes ([`_layout.tsx`](../../app/%28tabs%29/_layout.tsx)). Platform-specific UI is gated via `Platform.OS === 'web'`.
- **Hybrid components:** `.web.tsx` extensions override implementations for the browser when Metro resolves the platform suffix — e.g. [`components/TrailerPlayer.web.tsx`](../../components/TrailerPlayer.web.tsx) for YouTube iframes.
- **Auth flow:** Standard `signInWithPassword` in [`app/login.tsx`](../../app/login.tsx), shared with the TV redirect logic in [`app/index.tsx`](../../app/index.tsx).
