from aiohttp import web
import asyncio

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

async def ping_loop(ws):
    try:
        while not ws.closed:
            # await asyncio.sleep(2)
            # await ws.send_str('PING')
            print('PING TEST')
    except asyncio.CancelledError:
        pass

async def ws(request):
    print('Recieved Websocket request.')
    print('Active connections:', len(activeConnections))
    ws = web.WebSocketResponse()  # heartbeat=10)
    await ws.prepare(request)

    import json
    import time
    
    wsdata = {'ws': ws, 'lastRecievedAt': time.time()}
    activeConnections.append(wsdata)
    # ping_task = asyncio.create_task(ping_loop(ws))

    await ws.send_str(json.dumps({
        'type': 'video/mp4',  # video file mime type
    }))

    try:
        async for msg in ws:  # process messages as they come
            wsdata['lastRecievedAt'] = time.time()
            data = json.loads(msg.data)

            if data['op'] == 'PING':
                continue
            if data['op'] == 'IPREPORT':
                wsdata['public_ip'] = data['ip']
                print(wsdata['ws'], 'identified as', wsdata['public_ip'])
                continue

            for i in activeConnections:
                if i['ws'] is not ws:
                    await i['ws'].send_str(msg.data)
            print(data)
            
    finally:
        pass
        # ping_task.cancel()
        # try:
        #     await ping_task
        # except asyncio.CancelledError:
        #     pass

    activeConnections.remove(wsdata)
    print('========= removed ==========')
    print('Active connections:', len(activeConnections))
    return ws
