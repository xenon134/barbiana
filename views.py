from aiohttp import web

from pathlib import Path
website_root = Path('public').absolute()


async def file(request):
    return fileFromPath(website_root / request.path[1:], request.path)


def fileFromPath(path, requestPath):
    if path.is_dir():
        return fileFromPath(path / 'index.html', requestPath)
    if website_root not in path.absolute().parents:
        print('Refused:', requestPath)
        raise web.HTTPNotFound()  # 404
    if path.is_file():
        print('Served:', requestPath)
        return web.FileResponse(path)
    else:  # doesnt exist
        print('404:', requestPath)
        raise web.HTTPNotFound()


activeConnections = list()


async def ws(request):
    print('Recieved Websocket request.')
    ws = web.WebSocketResponse()  # heartbeat=10)
    await ws.prepare(request)

    activeConnections.append(ws)

    # await ws.receive_str()
    await ws.send_str('\n'.join((
        '/subs.vtt',  # path of subtitle file
        'video/mp4',  # video file mime type
        '1108346465',  # video file length, or a URL to the video file
    )))

    async for msg in ws:  # process messages as they come
        for i in activeConnections:
            if i is not ws:
                await i.send_str(msg.data)
        print(msg.data)

    activeConnections.remove(ws)
    print('removed')
    return ws
