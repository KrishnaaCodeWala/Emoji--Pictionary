# Emoji Pictionary: End-to-End Build Guide

This document outlines the architecture, database schema, and step-by-step engineering process for building "Emoji Pictionary," a real-time, turn-based multiplayer game for 2 to 5 players. 

## 1. Architecture & Tech Stack

Because Vercel (our hosting provider) uses serverless functions that do not natively support long-lived WebSocket connections, we are decoupling the real-time multiplayer state from the backend logic.

*   **Frontend UI & Routing:** Next.js (App Router)
*   **Styling:** Tailwind CSS (for rapid UI development)
*   **Backend API (Validation/State Changes):** Next.js Serverless API Routes
*   **Real-time Engine & Database:** Supabase (PostgreSQL + Realtime WebSockets)
*   **Hosting:** Vercel

## 2. Database Schema (Supabase)

We need three primary tables to manage the game state and multiplayer interactions.

### `rooms`
Manages the lifecycle of a game session.
*   `id` (UUID, Primary Key)
*   `room_code` (String, e.g., "ABCD", Unique)
*   `status` (String: 'lobby', 'playing', 'finished')
*   `current_drawer_id` (UUID, nullable)
*   `current_word` (String, nullable)
*   `round_end_time` (Timestamptz, nullable)

### `players`
Manages the users in a specific room.
*   `id` (UUID, Primary Key)
*   `room_id` (UUID, Foreign Key to `rooms.id`)
*   `nickname` (String)
*   `score` (Int, Default: 0)
*   `joined_at` (Timestamptz)

### `messages`
Acts as the conduit for both the "drawing" (emoji strings) and the "guessing" (chat).
*   `id` (UUID, Primary Key)
*   `room_id` (UUID, Foreign Key to `rooms.id`)
*   `player_id` (UUID, nullable, Foreign Key to `players.id`)
*   `content` (String - the guess, the emoji string, or system message)
*   `type` (String: 'guess', 'emoji_update', 'system')

## 3. Integrating the Multiplayer Aspect

The core of the multiplayer experience relies on **Supabase Realtime**. Here is how we connect multiple clients (2 to 5 players) together.

### Supabase Presence vs. Postgres Changes
*   **Postgres Changes:** We use this to listen to inserts/updates on the database. When a player submits a guess to the `messages` table, or when the host changes the `rooms` status to 'playing', Supabase broadcasts this change to all clients listening to that `room_id`.
*   **Supabase Presence:** We use this in the Lobby phase. When a user connects to a room channel, they register their "presence." This allows us to easily track who is currently online, handle accidental disconnects, and enforce our player limits.

### Enforcing the 2-5 Player Limit
1.  **Minimum 2 Players:** The "Start Game" button on the host's screen remains disabled until the `players` table (or Presence state) confirms at least 2 players are in the room.
2.  **Maximum 5 Players:** When a user attempts to join via a `room_code`, a Next.js API route first checks the count of players in that `room_id`. If `count >= 5`, the API returns a 403 Forbidden error, and the UI displays "Room is full."

## 4. End-to-End Build Process

### Step 1: Initialization & Database Setup
1.  Create a Next.js App (`npx create-next-app@latest`).
2.  Set up a new Supabase project.
3.  Create the `rooms`, `players`, and `messages` tables via the Supabase SQL editor.
4.  **Crucial:** Enable "Realtime" for the `rooms`, `players`, and `messages` tables in the Supabase Dashboard settings.
5.  Deploy the empty Next.js shell to Vercel and add your Supabase URL and Anon Key to Vercel's environment variables.

### Step 2: Lobby & Player Management
1.  **Create Room:** Build an API route `/api/rooms/create` that generates a 4-letter code, creates a `rooms` row, adds the host to the `players` table, and returns the room ID.
2.  **Join Room:** Build `/api/rooms/join` that validates the 5-player limit. If valid, insert the new player into the `players` table.
3.  **Real-time Lobby UI:** On the client side (e.g., `/room/[code]`), initialize a Supabase Realtime channel listening to the `players` table for that `room_id`. Display a live updating list of players.

### Step 3: The Game Loop
1.  **Starting the Game:** The host clicks "Start". An API route picks a random word from a server-side array, updates `rooms.current_word`, `rooms.current_drawer_id` (picking player 1), and changes status to 'playing'.
2.  **Client-Side Roles:** The frontend reads `rooms.current_drawer_id`. 
    *   If `current_drawer_id === my_player_id`: Render the secret word and an emoji picker component.
    *   If `current_drawer_id !== my_player_id`: Render a blank "canvas", a chat box for guessing, and hide the secret word.

### Step 4: Real-time Gameplay
1.  **Drawing (Emojis):** As the drawer selects emojis, the frontend pushes an update to the `messages` table with `type: 'emoji_update'`. 
2.  **Syncing Emojis:** The guessers' clients are subscribed to `messages` inserts. When an `emoji_update` arrives, it replaces the current content on their "canvas".
3.  **Guessing:** Guessers type into the chat. An API route `/api/guess` intercepts this. 
    *   The server checks if `guess.toLowerCase() === room.current_word.toLowerCase()`.
    *   If **No**: It saves the guess to `messages` as a standard chat message.
    *   If **Yes**: It awards points to the guesser (and optionally the drawer), saves a `system` message ("Player X guessed the word!"), and triggers the next turn by rotating the `current_drawer_id` and picking a new word.

### Step 5: Polish & Vercel Deployment
1.  Add a turn timer. You can manage this by saving a `round_end_time` in the `rooms` table. Clients calculate the remaining time locally to avoid spamming the database with "time left" updates.
2.  Ensure all environment variables are correctly set in Vercel.
3.  Test edge cases: What happens if the drawer disconnects? (Use Supabase Presence to detect the drop and automatically skip to the next player's turn).