from pyngrok import ngrok
tunnel = ngrok.connect("51510", "tcp")
print('\n' + 'Server started @ ' + tunnel.public_url.replace('tcp://', 'http://') + '\n')



from views import *

from aiohttp import web
app = web.Application()
app.logger.manager.disable = 100  # hide invalid method messages

app.router.add_get('/ws', ws)

async def shutdown(request):
    from aiohttp.web_runner import GracefulExit
    raise GracefulExit()
app.router.add_get('/shutdown', shutdown)

app.router.add_get('/{p:.*}', file)

web.run_app(app, port=51510)
