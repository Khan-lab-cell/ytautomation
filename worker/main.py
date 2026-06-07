import os
import re
import time
import asyncio
import secrets
import logging
from collections import defaultdict
from typing import Optional

import yt_dlp
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

app = FastAPI(title="yt-dlp worker", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("WORKER_API_KEY", "")
MAX_FILE_MB = int(os.environ.get("MAX_FILE_MB", "50"))
DOWNLOAD_TIMEOUT = int(os.environ.get("DOWNLOAD_TIMEOUT", "120"))
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", "10"))

YOUTUBE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")
_rate: dict[str, list[float]] = defaultdict(list)


def check_api_key(request: Request):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="WORKER_API_KEY not configured")
    provided = request.headers.get("X-API-Key") or request.headers.get("x-api-key")
    if not provided or not secrets.compare_digest(provided, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = [t for t in _rate[ip] if now - t < 60]
    if len(window) >= RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    window.append(now)
    _rate[ip] = window


def extract_video_id(url: str) -> Optional[str]:
    if not url:
        return None
    s = url.strip()
    if YOUTUBE_ID_RE.match(s):
        return s
    try:
        from urllib.parse import urlparse, parse_qs
        u = urlparse(s)
        host = u.hostname.replace("www.", "") if u.hostname else ""
        if host == "youtu.be":
            vid = u.path.lstrip("/").split("/")[0]
            return vid if YOUTUBE_ID_RE.match(vid) else None
        if host.endswith("youtube.com") or host.endswith("youtube-nocookie.com"):
            qv = parse_qs(u.query).get("v", [None])[0]
            if qv and YOUTUBE_ID_RE.match(qv):
                return qv
            parts = [p for p in u.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v"):
                return parts[1] if YOUTUBE_ID_RE.match(parts[1]) else None
    except Exception:
        pass
    m = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", s)
    return m.group(1) if m else None


@app.on_event("startup")
async def startup():
    deno_path = os.path.expanduser("~/.deno/bin")
    if os.path.isdir(deno_path) and deno_path not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{deno_path}:{os.environ['PATH']}"
        log.info("deno found at %s", deno_path)


@app.get("/")
async def root():
    return {"service": "yt-dlp-worker", "version": app.version}


@app.get("/health")
async def health():
    ytdlp_ver = yt_dlp.version.__version__
    ffmpeg_ver = "missing"
    try:
        out = await asyncio.create_subprocess_exec(
            "ffmpeg", "-version",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(out.communicate(), timeout=10)
        first = (stdout or b"").decode().split("\n", 1)[0]
        if " version " in first:
            ffmpeg_ver = first.split(" version ")[1].split(" ")[0]
    except Exception:
        pass
    return {"ok": True, "ytDlpVersion": ytdlp_ver, "ffmpegVersion": ffmpeg_ver}


@app.post("/download")
async def download(request: Request):
    check_api_key(request)
    check_rate_limit(request)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    url = body.get("url") if isinstance(body, dict) else None
    quality = int(body.get("quality", 360)) if isinstance(body, dict) else 360
    quality = max(144, min(quality, 1080))

    if not url:
        raise HTTPException(status_code=400, detail="Missing 'url' field")

    vid = extract_video_id(url)
    if not vid:
        raise HTTPException(status_code=400, detail="Not a valid YouTube URL")

    height_cap = quality
    max_bytes = MAX_FILE_MB * 1024 * 1024
    fmt = (
        f"best[height<={height_cap}][ext=mp4][acodec!=none]/"
        f"best[height<={height_cap}][ext=mp4]/"
        f"best[height<={height_cap}]/best"
    )

    log.info("download start id=%s quality=%d", vid, quality)

    async def stream():
        proc = None
        chunk_count = 0
        try:
            proc = await asyncio.create_subprocess_exec(
                "yt-dlp",
                "-f", fmt,
                "--max-filesize", str(max_bytes),
                "--no-playlist",
                "--no-warnings",
                "--no-progress",
                "--remote-components", "ejs:github",
                "-o", "-",
                f"https://www.youtube.com/watch?v={vid}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            while True:
                if await request.is_disconnected():
                    log.info("client disconnected id=%s", vid)
                    proc.kill()
                    return

                chunk = await asyncio.wait_for(
                    proc.stdout.read(64 * 1024),
                    timeout=DOWNLOAD_TIMEOUT,
                )
                if not chunk:
                    break
                yield chunk
                chunk_count += 1

            exit_code = await proc.wait()
            if exit_code != 0 and chunk_count == 0:
                stderr = await proc.stderr.read()
                err_text = stderr.decode(errors="replace")[:500]
                log.warning("yt-dlp exit %d id=%s: %s", exit_code, vid, err_text)

            log.info("download complete id=%s chunks=%d exit=%d", vid, chunk_count, exit_code)

        except asyncio.TimeoutError:
            log.warning("timeout id=%s", vid)
            if proc:
                proc.kill()
        except Exception as e:
            log.exception("stream error id=%s", vid)
            if proc:
                proc.kill()
        finally:
            if proc and proc.returncode is None:
                proc.kill()
                await proc.wait()

    return StreamingResponse(
        stream(),
        media_type="video/mp4",
        headers={
            "Cache-Control": "no-store",
            "X-Video-Id": vid,
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), workers=1)
