async function logmsg(msg) {
    console.log(msg);
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: 'log', message: msg }));
}

logmsg('Service Worker running.');

self.addEventListener('install', event => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim()); // Take control of all open pages immediately
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Intercept requests targeting the virtual P2P file
    if (url.pathname === '/virtual-p2p-video.mp4') {
        event.respondWith(handleP2PRequest(event.request, event.clientId));
    }
});

async function handleP2PRequest(request, clientId) {
    let t0 = new Date();
    // logmsg('Received request for ' + request.url);
    const client = await self.clients.get(clientId);
    if (!client) {
        return new Response("Active client not found to route WebRTC data.", { status: 500 });
    }

    const rangeHeader = request.headers.get('Range') || 'bytes=0-';

    return new Promise((resolve) => {
        const messageChannel = new MessageChannel();

        // Listen for the completed chunk from the main thread
        messageChannel.port1.onmessage = (msgEvent) => {
            const data = msgEvent.data;

            // Construct standard HTTP headers for partial video content
            const headers = new Headers({
                'Content-Type': data.mimeType,
                'Content-Length': (data.end - data.start + 1).toString(),
                'Content-Range': `bytes ${data.start}-${data.end}/${data.totalSize}`,
                'Accept-Ranges': 'bytes'
            });

            const response = new Response(data.chunk, {
                status: 206, // Partial Content
                headers: headers
            });

            resolve(response);

            // Calculate time taken
            const timeTaken = (new Date().getTime() - t0.getTime()) / 1000;
            logmsg('Bytes = ' + (data.end - data.start + 1) + ', Time = ' + timeTaken);
        };

        // Send the network request details to the main window
        client.postMessage({
            type: 'request-data',
            range: rangeHeader
        }, [messageChannel.port2]);
    });
}