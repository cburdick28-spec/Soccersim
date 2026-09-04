import os
import random
from dataclasses import dataclass
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

app = FastAPI(title="Pocket Manager Online (Python)")
templates = Jinja2Templates(directory="templates")


@dataclass
class Club:
    id: str
    league_id: str
    name: str
    reputation: int


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    } if SUPABASE_URL and SUPABASE_ANON_KEY else {}


async def _select(table: str, select: str, query: str = "") -> list[dict[str, Any]]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    if query:
        url = f"{url}&{query}"
    if not SUPABASE_URL:
        return []
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=_headers())
    response.raise_for_status()
    return response.json()


async def _upsert(table: str, rows: list[dict[str, Any]], on_conflict: str | None = None) -> None:
    suffix = ""
    if on_conflict:
        suffix = f"?on_conflict={on_conflict}"
    url = f"{SUPABASE_URL}/rest/v1/{table}{suffix}"
    headers = _headers() | {"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
    if not SUPABASE_URL:
        return
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=rows)
    response.raise_for_status()


def _avg(players: list[dict[str, Any]], field: str) -> float:
    values = [int(p.get(field, 50) or 50) for p in players]
    return sum(values) / max(len(values), 1)


def _simulate(home: Club, away: Club, home_players: list[dict[str, Any]], away_players: list[dict[str, Any]]) -> dict[str, Any]:
    home_attack = (_avg(home_players, "shooting") + _avg(home_players, "dribbling")) / 2
    away_attack = (_avg(away_players, "shooting") + _avg(away_players, "dribbling")) / 2
    home_def = (_avg(home_players, "defending") + _avg(home_players, "physical")) / 2
    away_def = (_avg(away_players, "defending") + _avg(away_players, "physical")) / 2

    home_strength = home_attack * 0.65 + home_def * 0.35 + home.reputation * 0.2 + 3
    away_strength = away_attack * 0.65 + away_def * 0.35 + away.reputation * 0.2

    xg_home = max(0.25, min(4.2, (home_strength - away_def * 0.25) / 18 + random.uniform(-0.15, 0.45)))
    xg_away = max(0.2, min(3.8, (away_strength - home_def * 0.25) / 18 + random.uniform(-0.2, 0.35)))
    home_goals = max(0, round(xg_home + random.uniform(-0.5, 0.7)))
    away_goals = max(0, round(xg_away + random.uniform(-0.5, 0.65)))
    possession_home = max(33, min(67, round(50 + (home_strength - away_strength) * 0.5 + random.uniform(-5, 5))))

    return {
        "home_goals": home_goals,
        "away_goals": away_goals,
        "xg_home": round(xg_home, 2),
        "xg_away": round(xg_away, 2),
        "possession_home": possession_home,
        "commentary": [
            f"Kick-off: {home.name} vs {away.name}.",
            f"{home.name} finished with {possession_home}% possession.",
            f"Full-time: {home.name} {home_goals} - {away_goals} {away.name}.",
        ],
    }


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    leagues = await _select("leagues", "id,name", "order=name")
    return templates.TemplateResponse("index.html", {"request": request, "leagues": leagues})




@app.get('/clubs', response_class=HTMLResponse)
async def clubs(request: Request, league_id: str | None = None):
    if not league_id:
        return templates.TemplateResponse('club_select.html', {'request': request, 'clubs': [], 'league_id': None})
    clubs = await _select('clubs', 'id,name', f'league_id=eq.{league_id}&order=name')
    league_rows = await _select('leagues', 'id,name', f'id=eq.{league_id}')
    league_name = league_rows[0]['name'] if league_rows else None
    return templates.TemplateResponse('club_select.html', {'request': request, 'clubs': clubs, 'league_id': league_id, 'league_name': league_name})


@app.get('/solo', response_class=HTMLResponse)
async def solo(request: Request, league_id: str | None = None, club_id: str | None = None):
    club = None
    if club_id:
        rows = await _select('clubs', 'id,league_id,name', f'id=eq.{club_id}')
        club = rows[0] if rows else None
    return templates.TemplateResponse('solo_game.html', {'request': request, 'league_id': league_id, 'club': club})


@app.post('/simulate', response_class=HTMLResponse)
async def simulate(request: Request, league_id: str = Form(...), club_id: str = Form(...)):
    # pick opponent
    clubs = await _select('clubs', 'id,name', f'league_id=eq.{league_id}&order=name')
    opponents = [c for c in clubs if c['id'] != club_id]
    if not opponents:
        return HTMLResponse('No opponent available', status_code=400)
    away = random.choice(opponents)
    home_rows = await _select('clubs', 'id,league_id,name,reputation', f'id=eq.{club_id}')
    if not home_rows:
        return HTMLResponse('Home club not found', status_code=400)
    home = Club(**{k: home_rows[0].get(k) for k in ('id', 'league_id', 'name', 'reputation')})
    away_club = Club(**{k: away.get(k) for k in ('id', 'league_id', 'name', 'reputation')})

    home_players = await _select('players', 'id,name,pace,shooting,passing,dribbling,defending,physical', f'club_id=eq.{home.id}')
    away_players = await _select('players', 'id,name,pace,shooting,passing,dribbling,defending,physical', f'club_id=eq.{away_club.id}')

    result = _simulate(home, away_club, home_players, away_players)

    # persist match (best-effort)
    match_row = {
        'season_id': None,
        'league_id': league_id,
        'home_club_id': home.id,
        'away_club_id': away_club.id,
        'matchday': 1,
        'status': 'completed',
        'home_goals': result['home_goals'],
        'away_goals': result['away_goals'],
        'xg_home': result['xg_home'],
        'xg_away': result['xg_away'],
        'possession_home': result['possession_home'],
        'commentary': result['commentary'],
    }
    try:
        await _upsert('matches', [match_row])
    except Exception:
        # ignore persistence errors but continue to show result
        pass

    return templates.TemplateResponse('result.html', {'request': request, 'result': result, 'home': home, 'away': away_club, 'league_id': league_id, 'club': {'id': club_id}})
