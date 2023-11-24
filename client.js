var iceConnectionLog = document.getElementById('ice-connection-state'),
    iceGatheringLog = document.getElementById('ice-gathering-state'),
    signalingLog = document.getElementById('signaling-state');

var pc = null;

function createPeerConnection() {
    pc = new RTCPeerConnection({});

    pc.addEventListener('icegatheringstatechange', function() {
        iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState;
    }, false);
    iceGatheringLog.textContent = pc.iceGatheringState;

    pc.addEventListener('iceconnectionstatechange', function() {
        iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState;
    }, false);
    iceConnectionLog.textContent = pc.iceConnectionState;

    pc.addEventListener('signalingstatechange', function() {
        signalingLog.textContent += ' -> ' + pc.signalingState;
    }, false);
    signalingLog.textContent = pc.signalingState;

    pc.addEventListener('track', function(evt) {
        document.getElementById('audio').srcObject = evt.streams[0];
     });

    return pc;
}

function negotiate() {
    const audioCapabilities = RTCRtpReceiver.getCapabilities('audio')
    audioCapabilities.codecs = audioCapabilities.codecs.filter(c => c.mimeType === 'audio/PCMU')
    pc.getTransceivers()[0].setCodecPreferences(audioCapabilities.codecs)

    return pc.createOffer()
    .then(o => pc.setLocalDescription(o))
    .then(function() {
        return new Promise(function(resolve) {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                pc.addEventListener('icegatheringstatechange', () => {
                    if (pc.iceGatheringState === 'complete') {
                        resolve();
                    }
                });
            }
        });
    }).then(function() {
        var offer = pc.localDescription;

        document.getElementById('offer-sdp').textContent = offer.sdp;
        return fetch('/offer', {
            body: JSON.stringify({
                sdp: offer.sdp,
                type: offer.type,
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });
    }).then(function(response) {
        return response.json();
    }).then(function(answer) {
        document.getElementById('answer-sdp').textContent = answer.sdp;
        return pc.setRemoteDescription(answer);
    }).catch(function(e) {
        alert(e);
    });
}

function start() {
    document.getElementById('start').style.display = 'none';
    pc = createPeerConnection();

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
    }).then(function(stream) {
        stream.getTracks().forEach(function(track) {
            pc.addTrack(track, stream);
        });
        return negotiate();
    }, function(err) {
        alert('Could not acquire media: ' + err);
    });

    document.getElementById('stop').style.display = 'inline-block';
}

function stop() {
    document.getElementById('stop').style.display = 'none';

    if (pc.getTransceivers) {
        pc.getTransceivers().forEach(function(transceiver) {
            if (transceiver.stop) {
                transceiver.stop();
            }
        });
    }

    pc.getSenders().forEach(function(sender) {
        sender.track.stop();
    });

    pc.close();
}
