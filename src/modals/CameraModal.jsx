import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, Video, Camera } from '../icons';
import { getIconComponent } from '../icons';
import AccessibleModalShell from '../components/ui/AccessibleModalShell';
import Go2RtcWebRtcPlayer from '../components/media/Go2RtcWebRtcPlayer';

const EMPTY_IMAGE_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function appendTs(url, ts) {
  if (!url) return '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_ts=${ts}`;
}

function buildCameraUrl(basePath, entityId, accessToken) {
  const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
  return `${basePath}/${entityId}${tokenQuery}`;
}

function resolveCameraTemplate(urlTemplate, entityId) {
  if (!urlTemplate) return '';
  const objectId = (entityId || '').includes('.')
    ? entityId.split('.').slice(1).join('.')
    : entityId;
  return urlTemplate
    .replaceAll('{entity_id}', entityId || '')
    .replaceAll('{entity_object_id}', objectId || '');
}

function normalizeStreamEngine(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'webrtc') return 'webrtc';
  if (raw === 'snapshot') return 'snapshot';
  if (raw === 'ha' || raw === 'ha_stream' || raw === 'hastream' || raw === 'ha-stream') return 'ha';
  return 'auto';
}

function getGo2rtcWebRtcUrl(url) {
  if (!url) return null;
  try {
    const origin = globalThis.window?.location?.origin || 'http://localhost';
    const parsed = new URL(url, origin);
    if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') return parsed.toString();
    const src = parsed.searchParams.get('src');
    const isGo2RtcPage = parsed.pathname.toLowerCase().endsWith('/stream.html');
    const isGo2RtcWs = parsed.pathname.toLowerCase().endsWith('/api/ws');
    if (!src || (!isGo2RtcPage && !isGo2RtcWs)) return null;
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = '/api/ws';
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function CameraModal({
  show,
  onClose,
  entityId,
  entity,
  customName,
  customIcon,
  getEntityImageUrl,
  settings,
  keepMounted = false,
  t,
}) {
  const [viewMode, setViewMode] = useState('stream');
  const [refreshTs, setRefreshTs] = useState(Date.now());
  const [streamSource, setStreamSource] = useState('ha');
  const mediaRef = useRef(null);
  const modalTitleId = `camera-modal-title-${(entityId || 'camera').replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const activeEntity = entity || { attributes: {} };
  const activeEntityId = entityId || '';
  const attrs = activeEntity.attributes || {};
  const directUrl = String(settings?.cameraDirectUrl || settings?.cameraWebrtcUrl || '').trim();
  const accessToken = attrs.access_token || '';
  const name =
    customName || attrs.friendly_name || activeEntityId || t?.('addCard.type.camera') || 'Camera';
  const iconName = customIcon || attrs.icon;
  const Icon = iconName ? getIconComponent(iconName) || Camera : Camera;

  const streamBase = useMemo(
    () =>
      activeEntityId
        ? buildCameraUrl('/api/camera_proxy_stream', activeEntityId, accessToken)
        : '',
    [activeEntityId, accessToken]
  );
  const snapshotBase = useMemo(() => {
    if (!activeEntityId) return '';
    return buildCameraUrl('/api/camera_proxy', activeEntityId, accessToken) || attrs.entity_picture;
  }, [activeEntityId, accessToken, attrs.entity_picture]);

  const streamUrl = getEntityImageUrl(streamBase);
  const snapshotUrl = getEntityImageUrl(appendTs(snapshotBase, refreshTs));
  const streamEngine = normalizeStreamEngine(settings?.cameraStreamEngine);
  const overlayPrimaryTemplate = String(settings?.cameraOverlayUrl || '').trim();
  const primaryStreamTemplate = overlayPrimaryTemplate || directUrl;
  const webrtcTemplate = primaryStreamTemplate;
  const webrtcUrl = useMemo(() => {
    const resolved = resolveCameraTemplate(webrtcTemplate, activeEntityId);
    return resolved ? getEntityImageUrl(resolved) : null;
  }, [webrtcTemplate, activeEntityId, getEntityImageUrl]);
  const go2rtcWebRtcUrl = useMemo(() => getGo2rtcWebRtcUrl(webrtcUrl), [webrtcUrl]);
  const extraCameraSources = useMemo(() => {
    const urls = Array.isArray(settings?.cameraExtraUrls) ? settings.cameraExtraUrls : [];
    return urls
      .slice(0, 2)
      .map((urlTemplate, index) => {
        const resolved = resolveCameraTemplate(String(urlTemplate || '').trim(), activeEntityId);
        if (!resolved) return null;
        const displayUrl = getEntityImageUrl(resolved);
        return {
          id: `extra-${index}`,
          title: `${name} ${index + 2}`,
          displayUrl,
          go2rtcUrl: getGo2rtcWebRtcUrl(displayUrl),
        };
      })
      .filter(Boolean);
  }, [settings?.cameraExtraUrls, activeEntityId, getEntityImageUrl, name]);

  const preferredSource = useMemo(() => {
    if (streamEngine === 'snapshot') return 'snapshot';
    if (streamEngine === 'webrtc') {
      if (go2rtcWebRtcUrl) return 'go2rtc-webrtc';
      if (webrtcUrl) return 'webrtc';
      return 'ha';
    }
    if (streamEngine === 'ha') return 'ha';
    if (go2rtcWebRtcUrl) return 'go2rtc-webrtc';
    if (webrtcUrl) return 'webrtc';
    return 'ha';
  }, [streamEngine, webrtcUrl, go2rtcWebRtcUrl]);

  useEffect(() => {
    if (viewMode === 'stream') {
      setStreamSource(preferredSource);
    }
  }, [preferredSource, viewMode]);

  const activeStreamUrl =
    streamSource === 'go2rtc-webrtc'
      ? go2rtcWebRtcUrl
      : streamSource === 'webrtc'
      ? webrtcUrl
      : streamSource === 'ha'
        ? streamUrl
        : snapshotUrl;

  const handleStreamError = () => {
    setStreamSource((current) => {
      if (current === 'webrtc') return streamUrl ? 'ha' : 'snapshot';
      if (current === 'ha') return 'snapshot';
      return 'snapshot';
    });
  };

  const releaseMedia = useCallback(() => {
    if (!mediaRef.current) return;
    mediaRef.current.src = EMPTY_IMAGE_SRC;
  }, []);

  const handleClose = useCallback(() => {
    releaseMedia();
    onClose?.();
  }, [onClose, releaseMedia]);

  useEffect(() => releaseMedia, [releaseMedia]);

  const isFallbackActive =
    viewMode === 'stream' && streamSource === 'snapshot' && preferredSource !== 'snapshot';

  const primaryCameraSource = {
    id: 'primary',
    title: name,
    displayUrl: activeStreamUrl,
    go2rtcUrl: streamSource === 'go2rtc-webrtc' ? go2rtcWebRtcUrl : null,
  };
  const overlayCameraSources =
    viewMode === 'stream'
      ? [primaryCameraSource, ...extraCameraSources].filter((source) => source.displayUrl)
      : [primaryCameraSource].filter((source) => source.displayUrl);
  const sideCameraSources = overlayCameraSources.slice(1, 3);

  const renderCameraPane = (source, className = '') => {
    const mediaClassName = 'h-full w-full object-contain';
    return (
      <div
        key={source.id}
        className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-black ${className}`}
      >
        {viewMode === 'stream' && source.go2rtcUrl ? (
          <Go2RtcWebRtcPlayer
            url={source.go2rtcUrl}
            title={source.title}
            className={mediaClassName}
            debugLabel={keepMounted ? `${source.id} ${source.go2rtcUrl}` : undefined}
            onError={source.id === 'primary' ? handleStreamError : undefined}
          />
        ) : (
          <img
            ref={source.id === 'primary' ? mediaRef : undefined}
            src={source.displayUrl}
            alt={source.title}
            className={mediaClassName}
            referrerPolicy="no-referrer"
            onError={source.id === 'primary' ? handleStreamError : undefined}
          />
        )}
      </div>
    );
  };

  if ((!show && !keepMounted) || (!activeEntityId && !directUrl)) return null;

  return (
    <AccessibleModalShell
      open={show && (!!activeEntityId || !!directUrl)}
      keepMounted={keepMounted}
      onClose={handleClose}
      titleId={modalTitleId}
      overlayClassName="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5"
      overlayStyle={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
      panelClassName="popup-anim relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl border p-4 font-sans shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6"
      panelStyle={{
        background: 'linear-gradient(135deg, var(--card-bg) 0%, var(--modal-bg) 100%)',
        borderColor: 'var(--glass-border)',
        color: 'var(--text-primary)',
      }}
    >
      {() => (
        <>
        <button
          onClick={handleClose}
          className="modal-close absolute top-4 right-4 z-10 sm:top-6 sm:right-6"
          aria-label={t?.('common.close') || 'Close'}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center justify-between gap-4 pr-12">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                {entityId}
              </p>
              <h3
                id={modalTitleId}
                className="truncate text-lg font-bold text-[var(--text-primary)] sm:text-2xl"
              >
                {name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode('stream');
                setStreamSource(preferredSource);
                setRefreshTs(Date.now());
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${viewMode === 'stream' ? 'border-[var(--accent-color)] bg-[var(--accent-bg)] text-[var(--accent-color)]' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
            >
              <span className="inline-flex items-center gap-1">
                <Video className="h-3.5 w-3.5" /> {t?.('camera.stream') || 'Stream'}
              </span>
            </button>
            <button
              onClick={() => {
                setViewMode('snapshot');
                setRefreshTs(Date.now());
              }}
              className={`rounded-xl border px-3 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${viewMode === 'snapshot' ? 'border-[var(--accent-color)] bg-[var(--accent-bg)] text-[var(--accent-color)]' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
            >
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" /> {t?.('camera.snapshot') || 'Snapshot'}
              </span>
            </button>
            <button
              onClick={() => {
                setStreamSource(preferredSource);
                setRefreshTs(Date.now());
              }}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              title={t?.('camera.refresh') || 'Refresh'}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative h-[min(68vh,720px)] min-h-[280px] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black">
          {viewMode === 'stream' && sideCameraSources.length > 0 ? (
            <div className="grid h-full w-full grid-cols-1 gap-px bg-[var(--glass-border)] md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
              {renderCameraPane(overlayCameraSources[0])}
              <div className="grid min-h-0 gap-px bg-[var(--glass-border)]">
                {sideCameraSources.map((source) => renderCameraPane(source))}
              </div>
            </div>
          ) : (
            renderCameraPane({
              id: 'primary',
              title: name,
              displayUrl: viewMode === 'snapshot' ? snapshotUrl : activeStreamUrl,
              go2rtcUrl:
                viewMode === 'stream' && streamSource === 'go2rtc-webrtc'
                  ? go2rtcWebRtcUrl
                  : null,
            })
          )}

          {isFallbackActive && (
            <div className="absolute inset-x-0 bottom-0 border-t border-amber-500/20 bg-amber-500/10 p-3 text-center text-sm text-amber-200">
              {t?.('camera.streamUnavailable') ||
                'Stream unavailable, showing snapshots may work better.'}
            </div>
          )}
        </div>
        </>
      )}
    </AccessibleModalShell>
  );
}
