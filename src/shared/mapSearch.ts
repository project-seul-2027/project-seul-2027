export type MapSearchPrecision = 'place' | 'address' | 'street' | 'area' | 'unknown';
export type MapSearchSource = 'naver' | 'kakao' | 'openstreetmap' | 'coordinates';

/** Provider result normalized for the map UI. Coordinates identify the mapped point, not necessarily an entrance. */
export interface RemoteMapSearchHit {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  source: MapSearchSource;
  precision: MapSearchPrecision;
}

export interface RemoteMapSearchResponse {
  hits: RemoteMapSearchHit[];
  providers: MapSearchSource[];
}

const precisionRank: Record<MapSearchPrecision, number> = {
  address: 4,
  place: 3,
  street: 2,
  area: 1,
  unknown: 0
};

/** Unifica i risultati quasi coincidenti mantenendo quello con la precisione più alta. */
export function dedupeMapSearchHits(hits: RemoteMapSearchHit[], thresholdMeters = 25): RemoteMapSearchHit[] {
  const unique: RemoteMapSearchHit[] = [];
  for (const hit of hits) {
    const duplicateIndex = unique.findIndex((current) => {
      const meanLat = ((current.lat + hit.lat) / 2) * (Math.PI / 180);
      const north = (current.lat - hit.lat) * 111_320;
      const east = (current.lng - hit.lng) * 111_320 * Math.cos(meanLat);
      return Math.hypot(north, east) < thresholdMeters;
    });
    if (duplicateIndex < 0) {
      unique.push(hit);
    } else if (precisionRank[hit.precision] > precisionRank[unique[duplicateIndex].precision]) {
      unique[duplicateIndex] = hit;
    }
  }
  return unique.sort((a, b) => precisionRank[b.precision] - precisionRank[a.precision]);
}
