# ReelDive

**Product Manager:** [Your Name]  
**Platform:** Cross-Platform (Web, iOS, Android, tvOS, Android TV)  
**Primary Architecture:** AI-Maintained Streaming Aggregator

---

## Product Requirements Document (PRD)

### 1. Executive Summary

The goal of this project is to build a unified streaming aggregator that allows users to search for movies and TV shows and instantly see which platforms they are streaming on, along with cast, crew, and high-resolution marketing materials.

Instead of relying on a human team or expensive premium APIs for data entry, this application will use AI-powered web scraping agents to autonomously fetch, format, and update the database in real-time when new searches occur or data becomes stale.

### 2. The Tech Stack

The AI development team must build the application using the following stack to ensure cross-platform compatibility and AI integration:

- **Frontend Client:** React Native with Expo (to compile to Web, iOS, Android, and TV native apps from a single codebase).
- **UI/Styling:** NativeWind (Tailwind CSS for React Native) for responsive, multi-device design.
- **Backend API:** FastAPI (Python) or Next.js (Node).
- **Database & Authentication:** Supabase (PostgreSQL).
- **AI Data Engine (Scraping):** Firecrawl API or ScrapeGraphAI.

### 3. Core Features (MVP)

The AI developer should focus on building the following core user flows for the Minimum Viable Product:

- **Universal Search:** A primary search bar where users can query titles, actors, or directors.
- **Dynamic Detail Pages:** When a movie/show is selected, the page must display the synopsis, release year, cast list, and high-resolution posters/backdrops.
- **Streaming Availability Module:** A clear UI block on the detail page showing exact platforms (Netflix, Hulu, Max, etc.) where the content is available, including whether it requires a subscription, rental, or purchase.
- **User Authentication & Watchlists:** Users must be able to create an account, save items to a watchlist, and mark items as "watched."

### 4. The AI Maintenance Workflow (Data Pipeline)

The backend must be programmed to handle data dynamically rather than relying solely on a static database. The AI developer must implement the following logic:

1. **Check Database First:** When a user searches for a title, the backend queries the Supabase Media table.
2. **Staleness Check:** If the title exists, the backend checks the `last_scraped_at` timestamp. If it is older than 7 days, the data is considered "stale."
3. **Trigger AI Scraper:** If the title does not exist OR the data is stale, the backend triggers the AI Data Engine (e.g., Firecrawl).
4. **Parse and Store:** The AI scraper navigates to target sources, extracts the latest streaming and cast data, formats it into JSON, and updates the PostgreSQL database.
5. **Serve to Frontend:** The fresh data is served back to the user interface.

### 5. Database Schema Structure

The backend must implement a relational PostgreSQL database (via Supabase) using the following core structure:

- **Media Table:** `id` (UUID), `type` (movie/tv), `title`, `synopsis`, `release_year`, `poster_url`, `backdrop_url`, `last_scraped_at` (Timestamp).
- **People Table:** `id` (UUID), `name`, `headshot_url`.
- **Platforms Table:** `id` (UUID), `name`, `logo_url`.
- **Media_Availability (Junction):** `id`, `media_id`, `platform_id`, `access_type` (subscription/rent/buy), `price`, `direct_url`.
- **Media_Cast_Crew (Junction):** `media_id`, `person_id`, `role_type` (actor/director), `character`.
- **Users & Watchlists Tables:** For tracking saved user preferences.

---

## Getting Started

### 1. Environment Variables

Copy `.env.example` to `.env` (or create `.env`) and fill in:

- `EXPO_PUBLIC_SUPABASE_URL` – From Supabase Dashboard
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` – From Supabase Dashboard
- `SUPABASE_SERVICE_ROLE_KEY` – **Required for scrape API.** From Supabase Dashboard > Project Settings > API > `service_role` (secret)
- `TMDB_API_KEY` – From [TMDB API Settings](https://www.themoviedb.org/settings/api) (server-side only, never exposed to frontend)
- `EXPO_PUBLIC_RAPIDAPI_KEY` – From [RapidAPI](https://rapidapi.com/) for the [Streaming Availability API](https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability) (direct deep links to streaming apps; embedded in the bundle—use RapidAPI app restrictions and quotas to limit abuse)

### 2. Run the App

```bash
# Install dependencies
npm install

# Run on web (API routes require web output: server)
npm run web

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### 3. Test the Search

Type a movie title (e.g. **"Inception"**) in the search bar and press Enter. The app will call the search API, fetch data via TMDB (with JustWatch streaming info), save it to Supabase, and display the result.
