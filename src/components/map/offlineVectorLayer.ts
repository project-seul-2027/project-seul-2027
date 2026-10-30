/**
 * Sfondo vettoriale per la mappa senza rete (stile OpenFreeMap salvato con "Scarica lo sfondo della mappa").
 * Caricato solo quando serve: MapLibre pesa parecchio e con la rete si usa Google.
 */
import L from 'leaflet';

export async function createOfflineVectorLayer(style: Record<string, unknown>): Promise<L.Layer> {
  (window as unknown as { L: typeof L }).L = L;
  await import('maplibre-gl/dist/maplibre-gl.css');
  const plugin = await import('@maplibre/maplibre-gl-leaflet');
  const factory = plugin.maplibreGL ?? plugin.default;
  return factory({
    style: style as never,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0
  } as never);
}
