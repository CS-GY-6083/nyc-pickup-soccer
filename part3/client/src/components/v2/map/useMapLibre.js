// Creates a MapLibre map in `ref` once the library has loaded. Follows the
// theme (OpenFreeMap positron / dark), and reports 'failed' when the style
// cannot load (offline, tiles blocked) so the page can say so.
//   const { map, lib, status, styleTick } = useMapLibre(ref, { center, zoom });
import { useEffect, useRef, useState } from 'react';
import useResolvedTheme from '@/lib/useResolvedTheme.js';
import { MAP_STYLES, NYC_CENTER, loadMapLibre } from './maplibre.js';

export default function useMapLibre(ref, { center = NYC_CENTER, zoom = 10, scrollZoom = true, controls = true, compactAttribution = false } = {}) {
  const theme = useResolvedTheme();
  const themeRef = useRef(theme);
  const [state, setState] = useState({ status: 'loading', map: null, lib: null });
  const [styleTick, setStyleTick] = useState(0);
  const init = useRef({ center, zoom, scrollZoom, controls, compactAttribution });

  useEffect(() => {
    let map;
    let ro;
    let cancelled = false;
    let loaded = false;
    const fail = () => {
      if (!loaded && !cancelled) setState((s) => ({ ...s, status: 'failed' }));
    };
    const timer = setTimeout(fail, 12000);
    const { center: c, zoom: z, scrollZoom: sz, controls: ctl, compactAttribution: compact } = init.current;
    loadMapLibre()
      .then((lib) => {
        if (cancelled || !ref.current) return;
        map = new lib.Map({
          container: ref.current,
          style: MAP_STYLES[themeRef.current],
          center: c,
          zoom: z,
          scrollZoom: sz,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: { compact },
        });
        map.touchZoomRotate.disableRotation();
        if (ctl) map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => {
          loaded = true;
          clearTimeout(timer);
          if (compact) {
            // Start collapsed to the (i) button; it opens on click.
            const attrib = ref.current?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show');
            attrib?.classList.remove('maplibregl-compact-show');
            attrib?.setAttribute('open', '');
          }
          if (!cancelled) setState({ status: 'ready', map, lib });
        });
        map.on('style.load', () => setStyleTick((t) => t + 1));
        map.on('error', () => fail());
        // Resize with the container (e.g. the mobile List / Map toggle).
        ro = new ResizeObserver(() => map.resize());
        ro.observe(ref.current);
        setState({ status: 'loading', map, lib });
      })
      .catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      ro?.disconnect();
      map?.remove();
    };
  }, [ref]);

  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    if (state.status === 'ready') state.map.setStyle(MAP_STYLES[theme]);
  }, [theme, state]);

  return { ...state, styleTick, theme };
}
