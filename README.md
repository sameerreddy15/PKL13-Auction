# PKL 13 Auction Simulator — Railway Multiplayer Fix

This version fixes two remaining online-room problems:

- Public Railway invite links now use the Railway public origin and never expose the internal container port.
- Direct invite URLs take priority over an old saved room, preventing the same browser from joining twice.
- Repeated `room:join` events from the same Socket.IO connection are idempotent and cannot create duplicate lobby slots.
- Switching rooms from the same connection cleanly leaves the previous Socket.IO room.
- Manual room-code joining continues to work and also accepts full invite URLs.

Health endpoint: `/api/health`
Server version: `1.1.0`

For Railway, use one replica while room state is stored in server memory.
