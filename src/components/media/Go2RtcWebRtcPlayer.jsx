import { useEffect, useRef } from 'react';

const CODECS = [
  'avc1.640029',
  'avc1.64002A',
  'avc1.640033',
  'hvc1.1.6.L153.B0',
  'mp4a.40.2',
  'mp4a.40.5',
  'flac',
  'opus',
];

const PC_CONFIG = {
  bundlePolicy: 'max-bundle',
  iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }],
  sdpSemantics: 'unified-plan',
};

function supportedCodecs(isSupported) {
  return CODECS.filter((codec) => isSupported(`video/mp4; codecs="${codec}"`)).join();
}

export default function Go2RtcWebRtcPlayer({ url, className, title, muted = true, onError }) {
  const videoRef = useRef(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!url || !videoRef.current) return undefined;

    let closed = false;
    let mseCodecs = '';
    let binaryFrames = 0;
    let socket = null;
    let peer = null;
    let mediaSource = null;
    let objectUrl = null;
    let sourceBuffer = null;
    const pendingBuffers = [];
    const video = videoRef.current;
    const debug = (...args) => console.debug('[Tunet go2rtc]', ...args);
    const fail = () => onErrorRef.current?.();

    debug('connecting', url);

    const play = () => {
      video.play?.().catch(() => {
        if (!video.muted) {
          video.muted = true;
          video.play?.().catch(() => {});
        }
      });
    };

    const cleanup = () => {
      closed = true;
      if (socket) {
        socket.close();
        socket = null;
      }
      if (peer) {
        peer.getSenders().forEach((sender) => sender.track?.stop());
        peer.close();
        peer = null;
      }
      if (sourceBuffer) {
        try {
          sourceBuffer.abort();
        } catch {
          // no-op
        }
      }
      sourceBuffer = null;
      pendingBuffers.length = 0;
      if (mediaSource?.readyState === 'open') {
        try {
          mediaSource.endOfStream();
        } catch {
          // no-op
        }
      }
      mediaSource = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      if (video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
      video.removeAttribute('src');
      video.load?.();
    };

    const send = (message) => {
      if (!closed && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const setupMse = () => {
      const MediaSourceImpl = globalThis.ManagedMediaSource || globalThis.MediaSource;
      if (!MediaSourceImpl) {
        debug('MSE unavailable');
        return;
      }

      mediaSource = new MediaSourceImpl();
      mediaSource.addEventListener(
        'sourceopen',
        () => {
          const codecs = supportedCodecs(MediaSourceImpl.isTypeSupported);
          debug('MSE requested', codecs || 'no supported codecs');
          send({ type: 'mse', value: codecs });
        },
        { once: true }
      );

      if (globalThis.ManagedMediaSource && mediaSource instanceof globalThis.ManagedMediaSource) {
        video.disableRemotePlayback = true;
        video.srcObject = mediaSource;
      } else {
        objectUrl = URL.createObjectURL(mediaSource);
        video.src = objectUrl;
        video.srcObject = null;
      }
      play();
    };

    const handleMseMessage = (message) => {
      if (message.type !== 'mse' || !mediaSource || sourceBuffer) return;
      mseCodecs = message.value || '';
      debug('MSE response', mseCodecs || 'no codec returned');
      if (!message.value) return;
      sourceBuffer = mediaSource.addSourceBuffer(message.value);
      sourceBuffer.mode = 'segments';
      sourceBuffer.addEventListener('updateend', () => {
        if (sourceBuffer?.updating || pendingBuffers.length === 0) return;
        try {
          sourceBuffer.appendBuffer(pendingBuffers.shift());
        } catch {
          // Keep WebRTC/MJPEG fallback paths alive if MSE chokes.
        }
      });
    };

    const handleMseData = (data) => {
      if (!sourceBuffer) return;
      binaryFrames += 1;
      if (binaryFrames === 1 || binaryFrames % 60 === 0) {
        debug('MSE binary frames', binaryFrames);
      }
      if (sourceBuffer.updating || pendingBuffers.length > 0) {
        pendingBuffers.push(data);
        return;
      }
      try {
        sourceBuffer.appendBuffer(data);
      } catch {
        // no-op
      }
    };

    const setupWebRtc = async () => {
      if (!('RTCPeerConnection' in window)) {
        debug('WebRTC unavailable');
        return;
      }

      peer = new RTCPeerConnection(PC_CONFIG);
      peer.addEventListener('icecandidate', (event) => {
        send({
          type: 'webrtc/candidate',
          value: event.candidate ? event.candidate.toJSON().candidate : '',
        });
      });

      peer.addEventListener('connectionstatechange', () => {
        if (!peer || closed) return;
        debug('WebRTC state', peer.connectionState);
        if (peer.connectionState === 'connected') {
          const tracks = peer
            .getTransceivers()
            .filter((transceiver) => transceiver.currentDirection === 'recvonly')
            .map((transceiver) => transceiver.receiver.track);
          const rtcStream = new MediaStream(tracks);

          const rtcPriority =
            (rtcStream.getVideoTracks().length ? (peer.remoteDescription?.sdp.includes('H265/90000') ? 0x240 : 0x220) : 0) +
            (rtcStream.getAudioTracks().length ? 0x102 : 0);
          const msePriority =
            (mseCodecs.includes('hvc1.') ? 0x230 : 0) +
            (mseCodecs.includes('avc1.') ? 0x210 : 0) +
            (mseCodecs.includes('mp4a.') ? 0x101 : 0);

          if (rtcPriority >= msePriority) {
            video.srcObject = rtcStream;
            play();
            debug('WebRTC playing');
          }
        }
      });

      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.addTransceiver('audio', { direction: 'recvonly' });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      debug('WebRTC offer sent');
      send({ type: 'webrtc/offer', value: offer.sdp });
    };

    socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      debug('WebSocket open');
      setupMse();
      setupWebRtc().catch((error) => {
        console.error('Failed to start go2rtc WebRTC stream:', error);
      });
    });
    socket.addEventListener('close', (event) => {
      debug('WebSocket close', { code: event.code, reason: event.reason, wasClean: event.wasClean });
    });
    socket.addEventListener('message', async (event) => {
      if (closed) return;
      if (typeof event.data !== 'string') {
        handleMseData(event.data);
        return;
      }

      try {
        const message = JSON.parse(event.data);
        debug('message', message.type, message.value ? String(message.value).slice(0, 120) : '');
        handleMseMessage(message);
        if (message.type === 'webrtc/answer') {
          debug('WebRTC answer received');
          await peer?.setRemoteDescription({ type: 'answer', sdp: message.value });
        } else if (message.type === 'webrtc/candidate' && message.value) {
          await peer?.addIceCandidate({ candidate: message.value, sdpMid: '0' });
        } else if (message.type === 'error') {
          console.warn('go2rtc stream error:', message.value);
        }
      } catch (error) {
        console.error('Failed to handle go2rtc stream message:', error);
        fail();
      }
    });
    socket.addEventListener('error', () => {
      debug('WebSocket error');
      fail();
    });

    return cleanup;
  }, [url]);

  return (
    <video
      ref={videoRef}
      title={title}
      className={className}
      autoPlay
      muted={muted}
      playsInline
    />
  );
}
