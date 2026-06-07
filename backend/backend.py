import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pyautogui
import time
import base64
import tempfile
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

#
# =============================
# Frontend (Vite) static files
# =============================
#
# Goal: make PyInstaller single-EXE also serve the React UI.
#
# When frozen by PyInstaller:
#   frontend/dist  will be bundled into:  _MEIPASS/frontend_dist
# When running from source:
#   we read: ../frontend/dist
#
def get_frontend_dist_dir() -> Path:
    if getattr(sys, "frozen", False):
        base_dir = Path(getattr(sys, "_MEIPASS", "."))
        return base_dir / "frontend_dist"
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


frontend_dist_dir = get_frontend_dist_dir()
frontend_index_path = frontend_dist_dir / "index.html"
frontend_assets_dir = frontend_dist_dir / "assets"
frontend_index_exists = frontend_index_path.exists()


def _safe_dist_file(relative_path: str) -> Optional[Path]:
    """Resolve a file under frontend_dist_dir, or None if unsafe / missing."""
    if not relative_path or relative_path.startswith(("/", "\\")):
        return None
    parts = relative_path.replace("\\", "/").split("/")
    if ".." in parts or "" in parts:
        return None
    base = frontend_dist_dir.resolve()
    candidate = (frontend_dist_dir / Path(*parts)).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None

# Mount built assets (js/css/img) when available.
if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_assets_dir), html=False), name="assets")


# =============================
# Data Models
# =============================

class Node(BaseModel):
    id: str
    data: Dict[str, Any]
    type: Optional[str] = None
    position: Optional[Dict[str, Any]] = None

    model_config = {"extra": "ignore"}


class Edge(BaseModel):
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

    model_config = {"extra": "ignore"}


class Flow(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    run_settings: Optional[Dict[str, Any]] = None


# =============================
# Image Utilities
# =============================

def save_temp_image(image_base64):
    if not image_base64:
        return None
    try:
        _, encoded = image_base64.split(",", 1)
        image_bytes = base64.b64decode(encoded)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        tmp.write(image_bytes)
        tmp.close()
        return tmp.name
    except Exception:
        return None


def find_image(image_base64, confidence=0.8):
    path = save_temp_image(image_base64)
    if not path:
        return None
    try:
        pos = pyautogui.locateCenterOnScreen(path, confidence=confidence)
        return pos
    except Exception as e:
        print("[ERROR find_image]", e)
        return None
    finally:
        if os.path.exists(path):
            os.remove(path)


def click_image(image_base64, confidence=0.8):
    pos = find_image(image_base64, confidence)
    if pos:
        print("  click at", pos)
        pyautogui.moveTo(pos, duration=0.2)
        pyautogui.click()
        return True
    else:
        print("  [x] Image not found")
        return False


def wait(seconds):
    print(f"  wait {seconds}s")
    time.sleep(seconds)


def wait_until(image_base64, interval=1, timeout=30):
    print("  waiting for image...")
    start = time.time()
    while True:
        pos = find_image(image_base64)
        if pos:
            print("  [ok] found")
            return True
        if time.time() - start > timeout:
            print("  [x] timeout")
            return False
        time.sleep(interval)


def click_position(x=None, y=None):
    if x is None or y is None:
        w, h = pyautogui.size()
        x, y = w // 2, h // 2
    print(f"  click ({x},{y})")
    pyautogui.moveTo(x, y, duration=0.2)
    pyautogui.click()


# =============================
# Node Execution
# =============================

def _global_wait_until_timeout(run_settings: Optional[Dict[str, Any]]) -> float:
    """Only global run_settings; per-node timeout is not used."""
    rs = run_settings or {}
    t_out = rs.get("waitUntilTimeout")
    if t_out is None:
        t_out = 30
    try:
        return float(t_out)
    except (TypeError, ValueError):
        return 30.0


def run_node(node: Node, run_settings: Optional[Dict[str, Any]] = None):
    data = node.data
    t = data.get("type")
    print(f">> EXEC {node.id} ({t})")

    if t == "click":
        click_image(data.get("image"))
    elif t == "wait":
        wait(data.get("time", 1))
    elif t == "waitUntil":
        wait_until(
            data.get("image"),
            data.get("interval", 1),
            _global_wait_until_timeout(run_settings),
        )
    elif t == "check":
        click_position(data.get("x"), data.get("y"))
    elif t == "press":
        key = data.get("key", "")
        if key:
            print(f"  press key: {key}")
            pyautogui.press(key)
        else:
            print("  [!] press: no key specified")
    elif t == "pressUntil":
        key = data.get("key", "")
        image = data.get("image")
        interval = data.get("interval", 1)
        timeout = _global_wait_until_timeout(run_settings)
        if not key:
            print("  [!] pressUntil: no key specified")
        elif not image:
            print("  [!] pressUntil: no image specified")
        else:
            print(f"  holding key [{key}], waiting for image (timeout={timeout}s)...")
            pyautogui.keyDown(key)
            try:
                start = time.time()
                found = False
                while True:
                    if find_image(image):
                        found = True
                        break
                    if time.time() - start > timeout:
                        print("  [x] pressUntil: timeout")
                        break
                    time.sleep(interval)
                if found:
                    print("  [ok] pressUntil: image found, releasing key")
            finally:
                pyautogui.keyUp(key)
    elif t == "start":
        pass
    else:
        print(f"  [!] Unknown type: {t}")


# =============================
# Build Execution Graph
# =============================

def build_maps(nodes, edges):
    node_map = {n.id: n for n in nodes}
    flow = {n.id: [] for n in nodes}
    ls_targets = {}
    le_targets = {}

    for e in edges:
        if e.sourceHandle == "right" and e.targetHandle == "left":
            flow[e.source].append(e.target)
        elif e.sourceHandle == "loop-start":
            ls_targets[e.source] = e.target
        elif e.sourceHandle == "loop-end":
            le_targets[e.source] = e.target

    loop_at_node = {}
    for loop_id, start_node_id in ls_targets.items():
        end_node_id = le_targets.get(loop_id)
        if end_node_id and loop_id in node_map:
            count = node_map[loop_id].data.get("count", 1)
            loop_at_node.setdefault(start_node_id, []).append({
                "loop_id": loop_id,
                "count": count,
                "end_id": end_node_id,
            })

    print(f"[build] flow: { {k: v for k, v in flow.items() if v} }")
    print(f"[build] loops: {loop_at_node}")
    return node_map, flow, loop_at_node


# =============================
# Streaming Execution Engine
# =============================

MAX_STEPS = 10000


def execute_stream(
    start_id,
    stop_before_id,
    node_map,
    flow,
    loop_at_node,
    active_loops=None,
    run_settings=None,
):
    """
    Generator: executes each node and yields its id immediately after.
    Callers use `yield from` for recursive loop calls.
    """
    if active_loops is None:
        active_loops = set()

    current = start_id
    steps = 0

    while current and current != stop_before_id:
        steps += 1
        if steps > MAX_STEPS:
            print("[!] Max steps reached")
            return

        node = node_map.get(current)
        if not node:
            return

        loop_info = None
        for li in loop_at_node.get(current, []):
            if li["loop_id"] not in active_loops:
                loop_info = li
                break

        if loop_info:
            count = loop_info["count"]
            end_id = loop_info["end_id"]
            loop_id = loop_info["loop_id"]
            inner_active = active_loops | {loop_id}

            print(f"\n--- Loop x{count}  {current} -> {end_id} ---")

            for i in range(count):
                yield {"type": "loop", "loop_id": loop_id, "current": i + 1, "total": count}
                print(f"  iteration {i + 1}/{count}")
                yield from execute_stream(
                    current,
                    end_id,
                    node_map,
                    flow,
                    loop_at_node,
                    inner_active,
                    run_settings,
                )
                end_node = node_map.get(end_id)
                if end_node:
                    run_node(end_node, run_settings)
                    yield {"type": "node", "node": end_id}

            print("--- Loop done ---\n")
            next_ids = flow.get(end_id, [])
            current = next_ids[0] if next_ids else None
            continue

        run_node(node, run_settings)
        yield {"type": "node", "node": current}

        next_ids = flow.get(current, [])
        current = next_ids[0] if next_ids else None


# =============================
# API
# =============================

@app.post("/run")
async def run_flow(flow_data: Flow):
    print("\n======== RUN (stream) ========")

    node_map, flow_graph, loop_at_node = build_maps(
        flow_data.nodes, flow_data.edges
    )

    if "start" not in node_map:
        return {"error": "No start node"}

    first_nodes = flow_graph.get("start", [])
    if not first_nodes:
        return {"error": "Start node has no outgoing connection"}

    rs = flow_data.run_settings

    def sse():
        for msg in execute_stream(
            first_nodes[0],
            None,
            node_map,
            flow_graph,
            loop_at_node,
            None,
            rs,
        ):
            yield f"data: {json.dumps(msg)}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/mouse_position")
async def get_mouse_position(delay: float = 2):
    print(f"Capturing mouse in {delay}s...")
    time.sleep(delay)
    x, y = pyautogui.position()
    print(f"  -> ({x},{y})")
    return {"x": x, "y": y}


@app.get("/mouse_live")
async def mouse_live():
    x, y = pyautogui.position()
    return {"x": x, "y": y}


@app.get("/index.html")
async def index_html():
    if not frontend_index_exists:
        raise HTTPException(status_code=404, detail="frontend index.html not found")
    return FileResponse(str(frontend_index_path))


@app.get("/favicon.ico")
async def favicon():
    if frontend_index_exists:
        dist_file = _safe_dist_file("favicon.ico")
        if dist_file is not None:
            return FileResponse(str(dist_file))
    # Return empty response to avoid 404 noise in browser
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")


@app.get("/")
async def home():
    if frontend_index_exists:
        return FileResponse(str(frontend_index_path))
    return {"message": "desk_auto backend running"}


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    # Let exact API routes (e.g. /run) handle themselves.
    # Serve real files from dist root (favicon, web_icon.svg, etc.); else SPA.
    if full_path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Not found")
    if frontend_index_exists:
        dist_file = _safe_dist_file(full_path)
        if dist_file is not None:
            return FileResponse(str(dist_file))
        return FileResponse(str(frontend_index_path))
    raise HTTPException(status_code=404, detail="Not found")

import socket

def find_free_port(preferred=59332):
    # Try preferred port first
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    # Fall back to any free port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    import uvicorn
    import threading
    import webbrowser

    port = find_free_port()
    url = f"http://127.0.0.1:{port}/"
    print(f"Running on {url}")

    # Write port to file so Vite proxy can pick it up
    port_file = Path(__file__).resolve().parent / ".backend_port"
    port_file.write_text(str(port))

    def open_browser():
        time.sleep(1)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run(app, host="127.0.0.1", port=port)
