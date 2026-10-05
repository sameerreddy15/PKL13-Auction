# PKL 13 Auction Simulator — Multiplayer Online Ready 🏆

Full real-time multiplayer PKL 13 auction simulator with WebSocket synchronization across phones, tablets, and PCs.

---

## 🚀 How to Run Multiplayer Online Mode

### Railway (recommended)

1. Push this project to GitHub.
2. In Railway, create a new project and choose **Deploy from GitHub Repo**.
3. Select this repository and branch `main`. Railway detects the Node.js app and can use the `npm start` script.
4. In the service, open **Settings → Networking → Public Networking → Generate Domain**.
5. Open the generated `https://<your-service>.up.railway.app` URL.
6. Create an auction room there and share the generated invite link/QR code with players.
7. Set the Railway health check path to `/api/health` (this project also includes the same setting in `railway.json`).

The frontend and Socket.IO server run from the same Railway service, so deployed clients use the same public origin for real-time multiplayer. Railway supplies the `PORT` value and the app binds to `0.0.0.0`.

### Option: Run locally on your network (Wi-Fi / LAN)

For different Wi-Fi networks or mobile data, use the Railway public URL. For same-network testing, run:

```bash
node server.js
```

The server prints the local and LAN URLs.

## 🌟 Multiplayer Features Included
- **Authoritative Real-Time Sync:** State is synchronized seamlessly via Socket.IO.
- **Mandatory User Names:** Every participant enters their name before creating or joining a room.
- **Shareable Invite & QR Code:** In-lobby 1-click invite link generator and instant QR code for mobile scanning.
- **Live Outbid Alerts & Audio Chime:** Instant visual pulse toast and pleasant synthesizer chime when another player outbids you.
- **In-Room Live Chat:** Real-time chat drawer in both the Lobby and Auction block.
- **Interactive Emoji Reactions:** Floating animated reactions (🔥, 💸, 👏, 😱, 🏆, ⚡) appearing live across all players' screens.
- **Live Presence Indicators:** Green status dots indicating connected vs disconnected players.
- **Smart Reconnection:** Automatically reconnects and restores user's assigned franchise slot upon page reload.
- **Standalone Offline Fallback:** If opened directly as a file without Node.js, seamlessly falls back to standalone local mode.

---

## 💰 Retention & Bidding Rules
- **ERP (Elite Retained Player):** ₹30–90 lakh.
- **RYP (Retained Young Player):** ₹13–50 lakh.
- **NYP (New Young Player):** Fixed ₹10.5 lakh.
- **Purse:** ₹5.00 Crore per franchise.
- **Squad Sizes:** 18–25 players (2–4 overseas players per team).
- **Normal Bid Increment:** +₹25,000 up to ₹1 Crore; +₹50,000 above ₹1 Crore. Quick jump buttons for +₹25L, +₹50L, and +₹1Cr.

