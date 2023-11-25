var videoElem, srcElem, subsElem;

var fileLength, mimeType, subsURL;

var ignorePlayEvent = false, ignorePauseEvent = false, ignoreSeekEvent = false, ignoreRatechangeEvent = false;

let url = new URL(window.location);
url.protocol = "ws:"; url.pathname = '/ws';
var websocket = new WebSocket(url);
var fmnry = true; // first message not recieved yet
websocket.addEventListener("message", ({ data }) => {
    if (fmnry) { // first message not recieved yet
        fmnry = false; // this is the first msg

        let parts = data.split("\n");
        subsURL = parts[0];
        mimeType = parts[1];
        fileLength = parseInt(parts[2]);
        if (isNaN(fileLength)) {
            initialize(parts[2]); // dont wait for button press
        }
    } else { // other messages
        let msg = data.substring(0,4);
        let arg = parseFloat(data.substring(5));
        switch (msg) {
            case "PLAY":
                ignoreSeekEvent = true;
                videoElem.currentTime = arg;
                ignorePlayEvent = true;
                videoElem.play();
            break;
            case "PAUS":
                ignorePauseEvent = true;
                videoElem.pause();
                ignoreSeekEvent = true;
                videoElem.currentTime = arg;
            break;
            case "RATE":
                ignoreRatechangeEvent = true;
                videoElem.playbackRate = arg;
            break;
            default:
                ignoreSeekEvent = true;
                videoElem.currentTime = arg;
        }
    }
});

websocket.addEventListener("close", function (event) {
    console.log('Connection Lost.');
});


function getfile() {
    let file = document.getElementById("fileInpElem").files[0];
    if (!file) {
        alert("No file selected.");
        return;
    } else if (file.size != fileLength) {
        // alert("Are you sure this is the right file?");
    }
    initialize(URL.createObjectURL(file));
}

function initialize(vidsrc) {
    initializeDOM(vidsrc);
    initializeSync();
    addEventListener('keydown', keyHandler, true);
}

function initializeDOM(vidsrc) {
    videoElem = document.createElement("video");
    videoElem.setAttribute("autoplay", true);
    videoElem.setAttribute("controls", true);
    videoElem.setAttribute("preload", "auto");
    videoElem.setAttribute("width", 853);
    videoElem.setAttribute("height", 480);
    videoElem.autoPictureInPicture = true;

    srcElem = document.createElement("source");
    srcElem.setAttribute("src", vidsrc);
    srcElem.setAttribute("type", mimeType);
    videoElem.appendChild(srcElem);

    subsElem = document.createElement("track");
    subsElem.setAttribute("label", "English");
    subsElem.setAttribute("kind", "subtitles");
    subsElem.setAttribute("srclang", "en");
    subsElem.setAttribute("src", subsURL);
    subsElem.setAttribute("default", true);
    videoElem.appendChild(subsElem);

    videoElem.textTracks[0].mode = "showing";

    document.body.appendChild(videoElem);
    document.getElementById("fileselector").setAttribute("hidden", true);

    videoElem.requestFullscreen();
}

function initializeSync() {
    videoElem.addEventListener("seeked", (event) => {
        if (ignoreSeekEvent) {
            ignoreSeekEvent = false;
        } else {
            websocket.send("SEEK " + videoElem.currentTime);
        }
    });
    videoElem.addEventListener("pause", (event) => {
        if (ignorePauseEvent) {
            ignorePauseEvent = false;
        } else {
            websocket.send("PAUS " + videoElem.currentTime);
        }
    });
    videoElem.addEventListener("play", (event) => {
        if (ignorePlayEvent) {
            ignorePlayEvent = false;
        } else {
            websocket.send("PLAY " + videoElem.currentTime);
        }
    });
    videoElem.addEventListener("ratechange", (event) => {
        if (ignoreRatechangeEvent) {
            ignoreRatechangeEvent = false;
        } else {
            websocket.send("RATE " + videoElem.playbackRate);
        }
    });
}

const a = 20; // factor
function keyHandler(event) {
    let kc = event.keyCode;
    //console.log(kc);
    if ((kc == 37) || (kc == 39)) { // left and right arrow, seeking
        event.preventDefault();
        let delta = event.shiftKey? 3: 10;
        delta = (kc == 37)? -delta: delta; // left arrow negative
        videoElem.currentTime += delta;
        console.log(delta);

    } if (kc == 32) { // space
        /*if (videoElem.paused) {
            videoElem.play();
        } else {
            videoElem.pause();
        }*/

    } else if ((kc == 219) || (kc == 221) || (kc == 187)) { // [ ] =
        let pr = videoElem.playbackRate;
        if (kc == 187) { // '='
            pr = 1;
        } else {
            let exp;
            if (kc == 219) { // '['
                exp = Math.exp((a * Math.log((16*pr - 1)/(16-pr)) - 1)/a - 2.772588722239781);
            } else { // kc = 221 ']'
                exp = Math.exp((a * Math.log((16*pr - 1)/(16-pr)) + 1)/a - 2.772588722239781);
            } pr = 15.9375 * exp / (exp + 1) + 0.0625;
        }
        videoElem.playbackRate = (Math.round(pr * 65536) == 65536)? 1: pr;
        console.log('Playback rate set to ' + pr); // DEBUG
    }
}
