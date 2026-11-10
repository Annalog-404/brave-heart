# Brave Heart

A private journal for gratitude, values, goals and events. It's a home-screen web app: no app store, no account, and your data stays on your phone.

Plain HTML, CSS and JavaScript. No build step, no dependencies, no server.

## What's inside

- **Setup**: on first open you write your mantra, and the app suggests your values from its words. You can leave any out or add your own.
- **Home**: your mantra, today's goal check-offs, goal progress and next event
- **Values**: each value with a daily practice, Swap, weekly count and your latest moment. Recommit monthly.
- **Log a moment**: what happened, who was there, how it felt before and after, what you learned
- **Journal**: morning (mood, 3 gratitudes, free writing, one photo, a year ago today) and evening (3 good things, values lived, let go, mood)
- **Goals**: daily goals (e.g. workout 20 days a month), weekly goals (e.g. call family 4 weeks a month) and amount goals (e.g. read 12 books). Each month shows done vs target, where you'd expect to be by today, and an overview. Daily and weekly goals are ticked off on Home and the Goals screen; amount goals keep a dated progress log.
- **Events**: one day or several, considering, registered or attended. Reflection fields appear once an event is marked attended.
- **Settings**: mantra and values, PIN lock, backup export and import, erase

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell and Content Security Policy |
| `styles.css` | Swiss Editorial design tokens and layout |
| `app.js` | All screens, storage and logic |
| `sw.js` | Offline support |
| `fonts/` | Inter, hosted with the app so nothing loads from Google, and its license |
| `manifest.webmanifest`, `icon*.png`, `apple-touch-icon.png` | Home-screen install |
| `_headers` | Security headers for Netlify and Cloudflare Pages |

## Run it on your computer

```bash
cd brave-heart
python3 -m http.server 8765
```

Then open http://localhost:8765. The service worker caches the app, so after changing a file, bump `CACHE` in `sw.js` or unregister the service worker in your browser's developer tools.

## Put it on your phone

The app must be served over HTTPS for "Add to Home Screen" and offline mode to work. Use Netlify (Netlify Drop is easiest, or connect this repository) or Cloudflare Pages. Both read `_headers` for the security headers.

Avoid GitHub Pages for hosting: every project on a `username.github.io` address shares one origin, so another project there could read this app's data. It also can't send the security headers. Keeping the code on GitHub is fine.

Then on iPhone: open the link in Safari, tap Share, then **Add to Home Screen**. On Android: open it in Chrome and tap **Install app**.

## Your data

- Everything is stored in the browser on your phone (localStorage for entries, IndexedDB for photos). Nothing is sent anywhere, and the app makes no requests to other sites.
- Clearing Safari's website data or deleting the home-screen app erases it. Use **Settings → Export backup** regularly. Safari in a normal tab and the home-screen app keep separate data.
- Backups are plain JSON, not encrypted. They don't include your PIN. Keep them somewhere private, and never commit them: `.gitignore` excludes backup files by name.
- Importing a backup checks every field first. A file that isn't a valid backup changes nothing.

## PIN lock

- The PIN is stored as a salted PBKDF2 hash, never in backups.
- After 3 wrong tries the app makes you wait, starting at 5 seconds and doubling up to 5 minutes.
- The screen is hidden when the app goes to the background, and the app locks again after a minute away. Unsaved form text is kept through a re-lock.
- Changing or turning off the lock needs the current PIN.
- The lock keeps casual eyes out; it does not encrypt your data.

## Updating the app

After changing any file, bump `CACHE` in `sw.js` (for example `brave-heart-v5` to `brave-heart-v6`). Phones download the new version in the background and switch to it the next time the app is reopened.

## License

The code is released under the [MIT License](LICENSE). The Inter font in `fonts/` is © The Inter Project Authors and is licensed under the [SIL Open Font License 1.1](fonts/LICENSE.txt).
