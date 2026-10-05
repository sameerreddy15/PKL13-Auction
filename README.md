# PKL 13 Auction Simulator — Railway Multiplayer Fixed

This version specifically fixes Room Invite Link and Manual Room Code joining.

## Deployment
1. Push the project to the GitHub repository used by Railway.
2. In Railway, deploy/redeploy the latest commit.
3. Keep the service at **1 replica** for now.
4. Generate/use the Railway public domain, for example `https://pkl-auction.up.railway.app`.
5. Verify `https://YOUR-DOMAIN/api/health` returns `status: ok`.

## Join fixes
- Manual Join button has only one click handler (duplicate click was removed).
- Room IDs accept copied invite URLs as well as plain 6-character codes.
- Join waits for the Socket.IO connection instead of racing the first page load.
- Join checks `/api/room/:id` with `no-store` before emitting `room:join`.
- Socket.IO uses polling first and upgrades to WebSocket for better reliability on mobile/proxy networks.
- Public invite URLs are generated from the actual Railway origin.
- Direct invite pages show the correct room and join through the same authenticated Socket.IO connection.
- Server room IDs are validated as exactly six alphanumeric characters.
- Room health and room lookup responses are not cached.
