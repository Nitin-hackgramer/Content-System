# Creator Studio

Mobile-first workspace over the Content Discovery pipeline (`../content discovery & idea`, never modified).

    cp .env.example .env.local   # fill SUPABASE_*; set DISCOVERY_DIR for run logs and Run/Brief actions
    npm install && npm run dev

- Reads ideas/trends from the pipeline's Supabase tables, server-side only. Falls back to the pipeline's local `saved_ideas.json`.
- Save/shortlist/archive state is stored in `discovery_kv` under the key `studio_idea_state` (no schema change).
- Run discovery / Write brief spawn the existing Python code from `DISCOVERY_DIR`; nothing is reimplemented.
- Licensed fonts: Söhne and Tiempos are used if installed locally; otherwise Inter / Newsreader stand in.
