# PKL 13 Auction Simulator — Multiplayer Online Ready 🏆

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sameerreddy15/PKL13-Auction)

Full real-time multiplayer PKL 13 auction simulator with WebSocket synchronization across phones, tablets, and PCs.

---

## 🚀 How to Run Multiplayer Online Mode

### Option 1: Run locally on your network (Wi-Fi / LAN)
1. Open PowerShell or Command Prompt in this folder:
   ```bash
   node server.js
   ```
2. The server will output your local and network URLs:
   ```
   ======================================================
     🏆 PKL 13 AUCTION SIMULATOR - MULTIPLAYER SERVER 🏆
   ======================================================
     Local URL:        http://localhost:3000
     Network (LAN) URL: http://192.168.1.38:3000
   ======================================================
   ```
3. **Host:** Open `http://localhost:3000` on your PC, enter your name, and click **Create Auction Room**.
4. **Friends:** Open the Network (LAN) URL (e.g., `http://192.168.1.38:3000`) on their phones or laptops connected to the same Wi-Fi, enter their name and Room ID, or scan the in-app **QR Code**!

---

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

