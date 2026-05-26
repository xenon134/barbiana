import asyncio
import json
import os
import re
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription

import views  # views.py contains the file serving and WebSocket handling logic

ROOT = os.path.join(os.path.dirname(__file__), 'public')

async def index(request):
    with open(os.path.join(ROOT, "index.html"), "r", encoding="utf-8") as f:
        content = f.read()
    return web.Response(content_type="text/html", text=content)

async def service_worker(request):
    with open(os.path.join(ROOT, "sw.js"), "r", encoding="utf-8") as f:
        content = f.read()
    # Service Workers require the correct MIME type
    return web.Response(content_type="application/javascript", text=content)

async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    request.app['pcs'].add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"Connection state is {pc.connectionState}")
        if pc.connectionState in ["failed", "closed", "wait"]:
            await pc.close()
            request.app['pcs'].discard(pc)

    @pc.on("datachannel")
    def on_datachannel(channel):
        print(f"Data channel established: {channel.label}")

        @channel.on("message")
        def on_message(message):
            if isinstance(message, str):
                handle_range_request(channel, message)

    def handle_range_request(channel, message):
        req = json.loads(message)
        req_id = req.get("id")
        range_header = req.get("range", "bytes=0-")
        
        # video_path = os.path.join(ROOT, "video.mp4")  # this is now taken from user input at server startup

        file_size = os.path.getsize(video_path)
        start = 0
        end = file_size - 1

        # Parse the standard HTTP Range header format
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if match:
            start = int(match.group(1))
            if match.group(2):
                end = int(match.group(2))

        # Enforce a maximum chunk size to prevent WebRTC message size overflow
        # Capped at 256KB per transmission. The browser will automatically request subsequent ranges.
        MAX_CHUNK = 256 * 1024
        end = min(end, start + MAX_CHUNK - 1)
        end = min(end, file_size - 1)

        with open(video_path, "rb") as f:
            f.seek(start)
            chunk_data = f.read(end - start + 1)

        # Transmit metadata so the client knows how to handle the incoming bytes
        metadata = {
            "id": req_id,
            "start": start,
            "end": end,
            "totalSize": file_size
        }
        
        # WebRTC Data Channels guarantee ordering by default.
        # Send JSON metadata first, followed by the binary payload.
        channel.send(json.dumps(metadata))
        channel.send(chunk_data)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

async def on_shutdown(app):
    coros = [pc.close() for pc in app['pcs']]
    await asyncio.gather(*coros)
    app['pcs'].clear()


if __name__ == "__main__":
    video_path = input('Video file path: ') or 'public\\video.mp4'
    assert video_path.endswith('.mp4'), "Video file must be in .mp4 format"
    subtitles_path = input('Subtitles file path: ') or 'public\\subs.vtt'
    assert subtitles_path.endswith('.vtt'), "Subtitles file must be in .vtt format"

    app = web.Application()
    app['pcs'] = set()  # Track active peer connections for cleanup on shutdown

    app.router.add_get("/", index)
    app.router.add_get("/sw.js", service_worker)
    app.router.add_post("/offer", offer)


    async def shutdown(request):
        from aiohttp.web_runner import GracefulExit
        raise GracefulExit()
    app.router.add_get('/shutdown', shutdown)

    app.router.add_get('/ws', views.ws)
    app.router.add_get('/subs.vtt', lambda request: web.FileResponse(subtitles_path))
    app.router.add_get('/{p:.*}', views.file)

    app.on_shutdown.append(on_shutdown)

    print("Starting WebRTC Server on http://localhost:51510")
    web.run_app(app, access_log=None, host="0.0.0.0", port=51510)
