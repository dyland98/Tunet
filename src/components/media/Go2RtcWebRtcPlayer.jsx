import { useEffect, useMemo, useRef } from 'react';

const CODECS = [
  'avc1.640029',
  'avc1.64002A',
  'avc1.640033',
  'hvc1.1.6.L153.B0',
];

function supportedCodecs(isSupported) {
  return CODECS.filter((codec) => isSupported(`video/mp4; codecs="${codec}"`)).join();
}

function getFrameUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const src = parsed.searchParams.get('src');
    if (!src) return null;
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
    parsed.pathname = '/api/frame.jpeg';
    parsed.search = '';
    parsed.searchParams.set('src', src);
    parsed.searchParams.set('_ts', String(Date.now()));
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function Go2RtcWebRtcPlayer({
  url,
  className,
  title,
  muted = true,
  onError,
  debugLabel,
}) {
  const videoRef = useRef(null);
  const posterUrl = useMemo(() => getFrameUrl(url), [url]);
  const onErrorRef = useRef(onError);
  const objectClass = className?.includes('object-cover') ? 'object-cover' : 'object-contain';

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!url || !videoRef.current) return undefined;

    let closed = false;
    let binaryFrames = 0;
    let socket = null;
    let mediaSource = null;
    let objectUrl = null;
    let sourceBuffer = null;
    const pendingBuffers = [];
    const video = videoRef.current;
    const startTime = performance.now();
    const elapsed = () => `${Math.round(performance.now() - startTime)}ms`;
    const debug = (...args) => {
      if (!debugLabel) return;
      console.debug('[Tunet camera warm]', elapsed(), debugLabel, ...args);
    };
    const fail = () => onErrorRef.current?.();

    debug('connecting', url);

    const logVideoEvent = (event) => debug('video', event.type);
    const videoEvents = ['loadeddata', 'playing', 'error'];
    videoEvents.forEach((eventName) => video.addEventListener(eventName, logVideoEvent));

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
        if (socket.readyState === WebSocket.CONNECTING) {
          const openingSocket = socket;
          openingSocket.addEventListener(
            'open',
            () => {
              openingSocket.close();
            },
            { once: true }
          );
        } else {
          socket.close();
        }
        socket = null;
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
      videoEvents.forEach((eventName) => video.removeEventListener(eventName, logVideoEvent));
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
      debug('MSE response', message.value || 'no codec returned');
      if (!message.value) return;
      sourceBuffer = mediaSource.addSourceBuffer(message.value);
      sourceBuffer.mode = 'segments';
      sourceBuffer.addEventListener('updateend', () => {
        if (!sourceBuffer || sourceBuffer.updating) return;

        if (pendingBuffers.length > 0) {
          try {
            sourceBuffer.appendBuffer(pendingBuffers.shift());
            return;
          } catch {
            // Keep the stream alive if one segment append fails.
          }
        }

        try {
          trimToLiveEdge();
        } catch {
          // no-op
        }
      });
    };

    const trimToLiveEdge = () => {
      if (!sourceBuffer?.buffered?.length || sourceBuffer.updating) return;
      const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      const liveStart = Math.max(0, end - 3);
      const bufferedStart = sourceBuffer.buffered.start(0);

      if (!Number.isFinite(video.currentTime) || video.currentTime < liveStart) {
        video.currentTime = liveStart;
      }

      const liveLag = end - video.currentTime;
      video.playbackRate = liveLag > 1 ? 1.25 : 1;
      mediaSource?.setLiveSeekableRange?.(liveStart, end);
      play();

      if (liveStart > bufferedStart + 1 && !sourceBuffer.updating) {
        sourceBuffer.remove(bufferedStart, liveStart);
      }
    };

    const handleMseData = (data) => {
      if (!sourceBuffer) return;
      binaryFrames += 1;
      if (binaryFrames === 1) {
        debug('first segment', {
          byteLength: data?.byteLength,
        });
      }
      if (sourceBuffer.updating || pendingBuffers.length > 0) {
        pendingBuffers.push(data);
        return;
      }
      try {
        sourceBuffer.appendBuffer(data);
        play();
        trimToLiveEdge();
      } catch {
        // no-op
      }
    };

    socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      debug('WebSocket open');
      setupMse();
    });
    socket.addEventListener('close', (event) => {
      debug('WebSocket close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
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
        if (message.type === 'error') {
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
    <div className={`relative overflow-hidden bg-black ${className || 'h-full w-full'}`}>
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full ${objectClass}`}
          referrerPolicy="no-referrer"
        />
      )}
      <video
        ref={videoRef}
        title={title}
        className={`absolute inset-0 h-full w-full ${objectClass}`}
        autoPlay
        muted={muted}
        playsInline
      />
    </div>
  );
}
