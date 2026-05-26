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
        event.respondWith(handleP2PRequest(event.request));
    }
});

async function handleP2PRequest(request) {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (!clients || clients.length === 0) {
        return new Response("No active clients found to route WebRTC data.", { status: 500 });
    }

    // Route the request to the first active client window controlling the WebRTC connection
    const client = clients[0];
    const rangeHeader = request.headers.get('Range') || 'bytes=0-';

    return new Promise((resolve) => {
        const messageChannel = new MessageChannel();

        // Listen for the completed chunk from the main thread
        messageChannel.port1.onmessage = (msgEvent) => {
            const data = msgEvent.data;

            // Construct standard HTTP headers for partial video content
            const headers = new Headers({
                'Content-Type': 'video/mp4',
                'Content-Length': (data.end - data.start + 1).toString(),
                'Content-Range': `bytes ${data.start}-${data.end}/${data.totalSize}`,
                'Accept-Ranges': 'bytes'
            });

            const response = new Response(data.chunk, {
                status: 206, // Partial Content
                headers: headers
            });

            resolve(response);
        };

        // Send the network request details to the main window
        client.postMessage({
            type: 'request-data',
            range: rangeHeader
        }, [messageChannel.port2]);
    });
}