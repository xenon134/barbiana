var videoElem, subsElem;

var mimeType;

var ignorePlayEvent = false, ignorePauseEvent = false, ignoreSeekEvent = false, ignoreRatechangeEvent = false;

function alertmsg(s) {
    const elem = document.getElementsByClassName("overlay")[0];
    window.logmsgs = elem.innerText;
    elem.innerText = s;
    elem.classList.add('statusmsg');
    let opacity = 0;
    const finalopacity = 0.75;
    const fadein_intervalID = window.setInterval(() => {
        opacity += finalopacity;
        elem.style.background = 'rgb(0, 0, 0, ' + opacity + ')';
        if (opacity >= finalopacity)
            window.clearInterval(fadein_intervalID);
    }, 1);
}

let url = new URL(window.location);
url.protocol = "ws:"; url.pathname = '/ws';
var websocket = new WebSocket(url);
var fmnry = true; // first message not recieved yet
// var lastRecievedAt = null;
websocket.addEventListener("message", ({ data }) => {
    // lastRecievedAt = Date.now();
    if (fmnry) { // first message not recieved yet
        console.log('First message recieved.')
        fmnry = false; // this is the first msg

        data = JSON.parse(data);
        mimeType = data['type'];
        console.log('Got here.')

        /* fetch(new Request("https://api.ipify.org?format=json")).then((response) => response.json())
            .then((resp) => {
                websocket.send(JSON.stringify({'op': 'IPREPORT', 'ip': resp['ip']}));
            }).catch(console.error); */

        var intervalID = window.setInterval(function() {
            // if ((Date.now() - lastRecievedAt) > 4000) {  // last message was over 6 seconds ago
            //     logmsg('Haven\'t heard from server in over ' + Math.round((Date.now() - lastRecievedAt)/1000) + ' seconds.');
            // }
            websocket.send('{"op": "PING"}');
        }, 2000);
    } else { // other messages
        data = JSON.parse(data);
        let msg = data['op'];  // operation
        switch (msg) {  
            case "PLAY":
                ignoreSeekEvent = true;
                if (data['time']) videoElem.currentTime = data['time'];
                ignorePlayEvent = true;
                videoElem.play();
            break;
            case "PAUS":
                ignorePauseEvent = true;
                videoElem.pause();
                ignoreSeekEvent = true;
                if (data['time']) videoElem.currentTime = data['time'];
            break;
            case "RATE":
                ignoreRatechangeEvent = true;
                videoElem.playbackRate = data['rate'];
            break;
            case "PING":
                //
            break;
            case "SEEK":
                if (Math.abs(data['time'] - videoElem.currentTime) > 2) {
                    ignoreSeekEvent = true;
                    videoElem.currentTime = data['time'];
                }
                break;
            default:
                logmsg('Unknown op: ' + msg);
        }
    }
});

websocket.addEventListener("close", function (event) {
    logmsg('Connection Lost.');
    // window.clearInterval(intervalID);
    // alert('Connection Lost.')
});


function initializeSync(vidsrc) {
    videoElem = document.getElementById("videoElement");
    window.setInterval(() => { videoElem.setAttribute("width", Math.round(0.8*window.innerWidth)); }, 100);
    videoElem.setAttribute("height", 480); // height depends on aspect ratio
    // videoElem.autoPictureInPicture = true;
    
    subsElem = document.createElement("track");
    subsElem.setAttribute("label", "English");
    subsElem.setAttribute("kind", "subtitles");
    subsElem.setAttribute("srclang", "en");
    subsElem.setAttribute("src", '/subs.vtt');
    subsElem.setAttribute("default", true);
    videoElem.appendChild(subsElem);

    videoElem.textTracks[0].mode = "showing";

    window.volumeControlClassObject = new VolumeControlClass(videoElem);  // make global
    // videoElem.requestFullscreen();

    attachListeners();
    addEventListener('keydown', keyHandler, true);
}

function attachListeners() {
    videoElem.addEventListener("seeked", (event) => {
        console.log('seeked event');
        if (ignoreSeekEvent) {
            ignoreSeekEvent = false;
        } else {
            websocket.send(JSON.stringify({op: "SEEK", time: videoElem.currentTime}));
        }
    });
    videoElem.addEventListener("pause", (event) => {
        if (ignorePauseEvent) {
            ignorePauseEvent = false;
        } else {
            websocket.send(JSON.stringify({op: "PAUS", time: videoElem.currentTime}));
        }
    });
    videoElem.addEventListener("play", (event) => {
        if (ignorePlayEvent) {
            ignorePlayEvent = false;
        } else {
            websocket.send(JSON.stringify({op: "PLAY", time: videoElem.currentTime}));
        }
    });
    videoElem.addEventListener("ratechange", (event) => {
        if (ignoreRatechangeEvent) {
            ignoreRatechangeEvent = false;
        } else {
            websocket.send(JSON.stringify({op: "RATE", rate: videoElem.playbackRate}));
        }
    });
}

const a = 20; // factor
function keyHandler(event) {
    let kc = event.keyCode;
    console.log(kc);
    if ((kc == 37) || (kc == 39)) { // left and right arrow, seeking
        event.preventDefault();
        let delta = event.shiftKey? 3: 10;
        delta = (kc == 37)? -delta: delta; // left arrow negative
        videoElem.currentTime += delta * videoElem.playbackRate;
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
        logmsg('Playback rate set to ' + Math.round(pr*100)/100 + 'x'); // DEBUG

    } else if ((kc == 38) || (kc == 40 )) {  //  up and down arrow
        if (kc == 38) // up
            volumeControlClassObject.changeBy(+0.01);
        else // down
            volumeControlClassObject.changeBy(-0.01);
        logmsg('Volume set to ' + Math.round(volumeControlClassObject.get()*100) + '%');
    }
}

class VolumeControlClass {
    constructor(videoElem) {
        this.videoElem = videoElem;
        this.logvolume = 1;  // 100%
        this.openGain();
    }
    openGain() {
        this.audioCtx = new AudioContext();
        this.source = this.audioCtx.createMediaElementSource(this.videoElem);
        this.gainNode = this.audioCtx.createGain();
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
    }
    get() {
        return this.logvolume;
    }
    set(newval) {
        this.logvolume = Math.round(newval * 1e5) / 1e5;  // round to 5 decimal points (0.001%)
        if (this.gainNode)  // is defined
            this.gainNode.gain.value = this.log_to_linear(newval);
        else {
            if (this.logvolume <= 1)
                this.videoElem.volume = this.log_to_linear(newval);
            else {
                this.openGain()
                this.gainNode.gain.value = this.log_to_linear(newval);
            }
        }
    }
    changeBy(diff) {
        this.set(this.get() + diff);
    }
    log_to_linear(v_log) {
        return v_log; // it seems to be fine
        // if (Math.abs(v_log - 1) < 1e-5)  // whithin (99.999, 100.001)
        //     return 1;
        // v_log = v_log * 100;  // change from fraction to %age
        // let v_linear = Math.exp((v_log - 19.83889)/17.41913);
        // v_linear = Math.min(v_linear, Number.MAX_VALUE);  // change infinity to Number.MAX_VALUE)
        // return v_linear / 100;  // change back to fraction
    }
}
