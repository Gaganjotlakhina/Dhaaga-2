# Dhaaga — the thread between you 💛

A small Progressive Web App so you and Ma can **buzz each other** (a real phone notification, even when the app is closed) and **see each other’s location while the app is open**, across Toronto ↔ Sri Ganganagar.

## What this can and can’t do (read this first)

|Feature                                            |Works in this PWA?                                                   |
|---------------------------------------------------|---------------------------------------------------------------------|
|Buzz → notification on the other phone (app closed)|✅ Yes (Android always; iPhone if installed to Home Screen, iOS 16.4+)|
|Quick pings + short messages                       |✅ Yes                                                                |
|Live location **while the app is open**            |✅ Yes                                                                |
|Two time-zone clocks + awake/asleep                |✅ Yes                                                                |
|**24/7 background location when the app is closed**|❌ No — browsers don’t allow this on iOS *or* Android                 |

For true always-on location you need a **native app** (React Native), or simply use **Google Maps / Apple “Find My” location sharing** for the live map and use Dhaaga for the buzz + emotional layer. That hybrid is what I’d actually recommend to start.

## Setup (about 15 minutes)

1. Install [Node.js](https://nodejs.org) (v18+).
1. In this folder, run:
   
   ```bash
   npm install
   npx web-push generate-vapid-keys
   ```
1. Copy the two keys it prints, then start the server with them set:
   
   ```bash
   # macOS / Linux
   VAPID_PUBLIC=PASTE_PUBLIC VAPID_PRIVATE=PASTE_PRIVATE npm start
   # Windows (PowerShell)
   $env:VAPID_PUBLIC="PASTE_PUBLIC"; $env:VAPID_PRIVATE="PASTE_PRIVATE"; npm start
   ```
1. Add two app icons named `icon-192.png` and `icon-512.png` to this folder (any square image works).

## Putting it on both phones

Push notifications **require HTTPS**, so deploy it (free options):

- **Render**, **Railway**, or **Fly.io** — deploy this whole folder as a Node app; set `VAPID_PUBLIC` and `VAPID_PRIVATE` as environment variables.
- Open the deployed URL on your phone → browser menu → **Add to Home Screen**. Do the same on Ma’s phone.
- On each phone: enter the **same secret code**, pick **You** / **Ma**, allow notifications and location.
- Tap **BUZZ**. The other phone buzzes. 💓

## Notes

- The server keeps data in memory (resets if it restarts). For something permanent, swap the `subs` / `locations` objects for a database (Supabase, Mongo, SQLite).
- This is a personal-use starter, not hardened security. Don’t reuse a guessable code if that matters to you.