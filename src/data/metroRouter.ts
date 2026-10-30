import { type LatLng, type MetroChain, type MetroLine, type MetroNetwork, type MetroStation } from './seoulMetro';
import { type MapLocation } from './tripData';

export interface WalkLeg {
  stationKey: string;
  station: MetroStation;
  lineId: string;
  distanceMeters: number;
  walkMinutes: number;
  fromLatLng: LatLng;
  toLatLng: LatLng;
  note?: string;
}

export interface MetroRouteSegment {
  line: MetroLine;
  branchLabel?: string;
  fromStationKey: string;
  fromStation: MetroStation;
  toStationKey: string;
  toStation: MetroStation;
  intermediateStationKeys: string[];
  intermediateStations: MetroStation[];
  stopCount: number;
  estimatedMinutes: number;
  directionStationEn: string;
  directionStationKo: string;
  terminalStationEn: string;
  terminalStationKo: string;
  directionSummary: string;
  pathGeometry: LatLng[];
}

export interface MetroTransferInfo {
  stationKey: string;
  station: MetroStation;
  fromLine: MetroLine;
  toLine: MetroLine;
  isSameLineBranchChange: boolean;
  latLng: LatLng;
}

export interface NearestStationSummary {
  stationKey: string;
  station: MetroStation;
  distanceMeters: number;
  walkMinutes: number;
  lines: MetroLine[];
  latLng: LatLng;
}

export interface MetroRouteResult {
  reachable: boolean;
  origin: MapLocation;
  destination: MapLocation;
  originOutOfMetroCoverage?: boolean;
  nearestOriginStation?: NearestStationSummary;
  reasonIfUnreachable?: string;
  nearestStationIfUnreachable?: {
    stationKey: string;
    station: MetroStation;
    distanceMeters: number;
    lines: MetroLine[];
  };
  walkStart?: WalkLeg;
  walkEnd?: WalkLeg;
  segments: MetroRouteSegment[];
  transfers: MetroTransferInfo[];
  totalStops: number;
  totalTransfers: number;
  totalWalkMeters: number;
  estimatedTotalMinutes: number;
  /** Linee escluse dal calcolo (es. AREX), se l'utente ha scelto di evitarle */
  excludedLineIds?: string[];
}

/** Identificativo della linea AREX (treno per l'aeroporto) nei dati della rete */
export const AREX_LINE_ID = 'A';

/** Cosa privilegiare nella scelta del percorso */
export type RoutePreference = 'fast' | 'fewTransfers' | 'lessWalking';

export const ROUTE_PREFERENCE_PARAMS: Record<RoutePreference, { transferExtra: number; walkMul: number }> = {
  /** Equilibrio standard (come prima) */
  fast: { transferExtra: 0, walkMul: 1 },
  /** Ogni cambio pesa come ~13 minuti: si accetta qualche fermata in più pur di non cambiare */
  fewTransfers: { transferExtra: 8, walkMul: 1 },
  /** Ogni metro a piedi pesa 3 volte tanto */
  lessWalking: { transferExtra: 0, walkMul: 3 }
};

export interface MetroRouteOptions {
  /** Linee da non usare mai (si va solo con le altre linee e a piedi) */
  excludeLineIds?: readonly string[];
  /** Più veloce (predefinito), meno cambi o meno camminata */
  preference?: RoutePreference;
}

/** Distanza geodetica in metri tra due coordinate [lat, lng] */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Raggio massimo (in metri) per raggiungere a piedi una stazione dall'alloggio */
const MAX_ORIGIN_WALK_M = 1200;

/** Raggio massimo (in metri) per considerare una posizione GPS "in prossimità della metro" */
export const MAX_GPS_ORIGIN_WALK_M = 2400;

/** Raggio massimo (in metri) standard dalla stazione di arrivo alla tappa */
const DEFAULT_MAX_DEST_WALK_M = 1750;

/**
 * Alcune tappe vaste (parchi nazionali, mura della fortezza di Suwon, complesso aeroportuale di Incheon)
 * hanno il pin geografico al centro del parco/monumento ma sono servite ufficialmente da una stazione dedicata.
 */
const EXTENDED_WALK_DESTINATIONS: Record<string, { maxMeters: number; note: string }> = {
  bukhansan_national_park: {
    maxMeters: 2100,
    note: 'Dalla stazione Bukhansan Ui (capolinea Ui-Sinseol) parte il sentiero escursionistico verso l\'ingresso del Parco Nazionale.'
  },
  suwon_hwaseong: {
    maxMeters: 2650,
    note: 'Dalla stazione di Hwaseo o Suwon (Linea 1 / Suin-Bundang) si prosegue a piedi o con bus urbano per 10 min fino alle mura UNESCO.'
  },
  incheon_airport: {
    maxMeters: 2200,
    note: 'Le stazioni AREX sono integrate direttamente nei Terminal 1 e Terminal 2 dell\'aeroporto di Incheon.'
  },
  namsan_tower: {
    maxMeters: 1600,
    note: 'Dalla stazione Myeongdong o Hoehyeon (Linea 4) si sale a piedi lungo il sentiero panoramico gratuito del Monte Namsan (~25-30 min).'
  }
};

/** Note esplicative per le tappe non raggiungibili via metro */
const UNREACHABLE_CUSTOM_REASONS: Record<string, string> = {
  dmz_imjingak:
    'Il Confine DMZ e il Parco di Imjingak si trovano nella zona di controllo militare a nord di Paju, oltre 5,8 km dopo il capolinea Munsan della linea Gyeongui-Jungang. Come previsto dall\'itinerario (Giorno 15), questa tappa è raggiungibile esclusivamente tramite il tour organizzato in pullman o navetta autorizzata da Seul.'
};

interface GraphEdge {
  toNode: string;
  cost: number;
  kind: 'ride' | 'branch-through' | 'transfer';
  lineId: string;
  chainIndex: number;
  fromStationIdx?: number;
  toStationIdx?: number;
  dir?: 1 | -1;
}

interface NodeMeta {
  nodeId: string;
  stationKey: string;
  lineId: string;
  chainIndex: number;
  stationIdxInChain: number;
}

interface BuiltMetroGraph {
  nodes: Map<string, NodeMeta>;
  adj: Map<string, GraphEdge[]>;
  nodesByStation: Map<string, NodeMeta[]>;
  linesById: Map<string, MetroLine>;
}

const graphCache = new WeakMap<MetroNetwork, BuiltMetroGraph>();

function makeNodeId(stationKey: string, lineId: string, chainIndex: number, stationIdxInChain: number): string {
  return `${stationKey}|${lineId}|${chainIndex}|${stationIdxInChain}`;
}

function getOrBuildGraph(network: MetroNetwork): BuiltMetroGraph {
  const cached = graphCache.get(network);
  if (cached) return cached;

  const nodes = new Map<string, NodeMeta>();
  const adj = new Map<string, GraphEdge[]>();
  const nodesByStation = new Map<string, NodeMeta[]>();
  const linesById = new Map<string, MetroLine>(network.lines.map((l) => [l.id, l]));

  const addEdge = (from: string, edge: GraphEdge) => {
    let list = adj.get(from);
    if (!list) {
      list = [];
      adj.set(from, list);
    }
    list.push(edge);
  };

  // 1. Crea i nodi e gli archi lungo ciascun ramo (chain) di ogni linea
  for (const line of network.lines) {
    line.chains.forEach((chain, chainIndex) => {
      const n = chain.stations.length;
      if (n === 0) return;

      const chainNodes: string[] = [];
      for (let i = 0; i < n; i++) {
        const stKey = chain.stations[i];
        const nodeId = makeNodeId(stKey, line.id, chainIndex, i);
        const meta: NodeMeta = {
          nodeId,
          stationKey: stKey,
          lineId: line.id,
          chainIndex,
          stationIdxInChain: i
        };
        nodes.set(nodeId, meta);
        chainNodes.push(nodeId);

        let stList = nodesByStation.get(stKey);
        if (!stList) {
          stList = [];
          nodesByStation.set(stKey, stList);
        }
        stList.push(meta);
      }

      if (!chain.loop) {
        // Linea lineare bidirezionale
        for (let i = 0; i < n - 1; i++) {
          const u = chainNodes[i];
          const v = chainNodes[i + 1];
          // Costo 1.0 per fermata (~2 min)
          addEdge(u, {
            toNode: v,
            cost: 1.0,
            kind: 'ride',
            lineId: line.id,
            chainIndex,
            fromStationIdx: i,
            toStationIdx: i + 1,
            dir: 1
          });
          addEdge(v, {
            toNode: u,
            cost: 1.0,
            kind: 'ride',
            lineId: line.id,
            chainIndex,
            fromStationIdx: i + 1,
            toStationIdx: i,
            dir: -1
          });
        }
      } else {
        // Anello circolare (Linea 2 circolare bidirezionale; Linea 6 anello Eungam)
        const isBidirectionalLoop = line.id === '2';
        for (let i = 0; i < n; i++) {
          const next = (i + 1) % n;
          const u = chainNodes[i];
          const v = chainNodes[next];
          addEdge(u, {
            toNode: v,
            cost: 1.0,
            kind: 'ride',
            lineId: line.id,
            chainIndex,
            fromStationIdx: i,
            toStationIdx: next,
            dir: 1
          });
          if (isBidirectionalLoop) {
            addEdge(v, {
              toNode: u,
              cost: 1.0,
              kind: 'ride',
              lineId: line.id,
              chainIndex,
              fromStationIdx: next,
              toStationIdx: i,
              dir: -1
            });
          }
        }
      }
    });
  }

  // 2. Crea gli archi di interscambio (tra linee diverse o rami della stessa linea nella stessa stazione)
  // Penalità bilanciata:
  // - Cambio tra linee diverse: 5.5 (pari a ~5-6 fermate, evita cambi per risparmiare 1-2 fermate)
  // - Cambio navetta diramazione Linea 2 (Seongsu / Sindorim): 3.2
  // - Prosecuzione su diramazione passante della stessa linea (es. Linea 1 a Guro, Linea 5 a Gang동): 0.3
  for (const [, stNodes] of nodesByStation.entries()) {
    if (stNodes.length < 2) continue;
    for (let i = 0; i < stNodes.length; i++) {
      for (let j = 0; j < stNodes.length; j++) {
        if (i === j) continue;
        const a = stNodes[i];
        const b = stNodes[j];

        if (a.lineId === b.lineId) {
          // Stessa linea, ramo diverso (o stessa stazione sull'anello)
          const isLine2ShuttleBranch = a.lineId === '2' && a.chainIndex !== b.chainIndex;
          addEdge(a.nodeId, {
            toNode: b.nodeId,
            cost: isLine2ShuttleBranch ? 3.2 : 0.3,
            kind: isLine2ShuttleBranch ? 'transfer' : 'branch-through',
            lineId: b.lineId,
            chainIndex: b.chainIndex
          });
        } else {
          // Cambio tra due linee diverse nella stessa stazione di interscambio
          addEdge(a.nodeId, {
            toNode: b.nodeId,
            cost: 5.5,
            kind: 'transfer',
            lineId: b.lineId,
            chainIndex: b.chainIndex
          });
        }
      }
    }
  }

  const built: BuiltMetroGraph = { nodes, adj, nodesByStation, linesById };
  graphCache.set(network, built);
  return built;
}

/** Estrae il tracciato geografico reale [lat, lng][] per un singolo hop tra due stazioni consecutive su una chain */
function extractHopGeometry(chain: MetroChain, fromIdx: number, toIdx: number, dir: 1 | -1): LatLng[] {
  const n = chain.stations.length;
  if (!chain.loop) {
    if (dir === 1) {
      const start = chain.at[fromIdx];
      const end = chain.at[toIdx];
      return chain.path.slice(start, end + 1);
    } else {
      const start = chain.at[toIdx];
      const end = chain.at[fromIdx];
      return chain.path.slice(start, end + 1).reverse();
    }
  } else {
    // Chain circolare (loop: true)
    if (dir === 1) {
      if (fromIdx < n - 1 && toIdx === fromIdx + 1) {
        return chain.path.slice(chain.at[fromIdx], chain.at[toIdx] + 1);
      }
      // Chiusura dell'anello dall'ultima stazione (n - 1) alla prima (0)
      const tail = chain.path.slice(chain.at[fromIdx]);
      const head = chain.path.slice(0, chain.at[0] + 1);
      return head.length > 1 ? [...tail, ...head.slice(1)] : tail;
    } else {
      // Direzione opposta sull'anello: invertiamo il segmento forward da toIdx a fromIdx
      const forward = extractHopGeometry(chain, toIdx, fromIdx, 1);
      return [...forward].reverse();
    }
  }
}

/** Restituisce l'etichetta della diramazione (se applicabile, es. Linea 2 Seongsu / Sinseol-dong) */
function getBranchLabel(line: MetroLine, chainIndex: number): string | undefined {
  if (line.id === '2') {
    if (chainIndex === 0) return 'Anello Circolare Principale';
    if (chainIndex === 1) return 'Diramazione Seongsu – Sinseol-dong';
    if (chainIndex === 2) return 'Diramazione Sindorim – Kkachisan';
  }
  if (line.id === '1' && chainIndex === 1) {
    return 'Ramo Guro – Suwon – Sinchang';
  }
  if (line.id === '5' && chainIndex === 1) {
    return 'Ramo Gangdong – Macheon';
  }
  return undefined;
}

/** Determina il capolinea / direzione per orientarsi sui cartelli in banchina */
function getDirectionInfo(
  network: MetroNetwork,
  line: MetroLine,
  chainIndex: number,
  firstHopFromIdx: number,
  firstHopToIdx: number,
  lastStationKey: string,
  dir: 1 | -1
): {
  directionStationEn: string;
  directionStationKo: string;
  terminalStationEn: string;
  terminalStationKo: string;
  directionSummary: string;
} {
  const chain = line.chains[chainIndex];
  const nextStKey = chain.stations[firstHopToIdx];
  const nextSt = network.stations[nextStKey];

  if (chain.loop && line.id === '2') {
    const circleType = dir === 1 ? 'Circolare interna (내선순환)' : 'Circolare esterna (외선순환)';
    const destSt = network.stations[lastStationKey];
    return {
      directionStationEn: nextSt.en,
      directionStationKo: nextSt.ko,
      terminalStationEn: destSt.en,
      terminalStationKo: destSt.ko,
      directionSummary: `${circleType} · direzione ${nextSt.en} (${nextSt.ko})`
    };
  }

  const terminalKey = dir === 1 ? chain.stations[chain.stations.length - 1] : chain.stations[0];
  const terminalSt = network.stations[terminalKey];

  return {
    directionStationEn: nextSt.en,
    directionStationKo: nextSt.ko,
    terminalStationEn: terminalSt.en,
    terminalStationKo: terminalSt.ko,
    directionSummary:
      terminalKey === nextStKey
        ? `Direzione capolinea ${terminalSt.en} (${terminalSt.ko})`
        : `Direzione ${nextSt.en} · verso ${terminalSt.en} (${terminalSt.ko})`
  };
}

/** Trova la stazione più vicina in assoluto a una coordinata [lat, lng] */
export function findAbsoluteNearestStation(
  network: MetroNetwork,
  linesById: Map<string, MetroLine>,
  point: LatLng
): NearestStationSummary | undefined {
  let bestKey = '';
  let bestDist = Infinity;
  let bestPos: LatLng = point;

  for (const [key, st] of Object.entries(network.stations)) {
    const firstPos = Object.values(st.at)[0];
    if (!firstPos) continue;
    const d = haversineMeters(point, firstPos);
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
      bestPos = firstPos;
    }
  }

  if (!bestKey) return undefined;
  const station = network.stations[bestKey];
  const lines = Object.keys(station.at)
    .map((id) => linesById.get(id))
    .filter((l): l is MetroLine => Boolean(l));

  const distanceMeters = Math.round(bestDist);
  return {
    stationKey: bestKey,
    station,
    distanceMeters,
    walkMinutes: Math.max(1, Math.round(distanceMeters / 75)),
    lines,
    latLng: bestPos
  };
}

/**
 * Restituisce le stazioni metro più vicine a una coordinata [lat, lng] ordinate per distanza.
 */
export function findNearbyMetroStations(
  network: MetroNetwork,
  point: LatLng,
  maxMeters = MAX_GPS_ORIGIN_WALK_M,
  limit = 4
): NearestStationSummary[] {
  const graph = getOrBuildGraph(network);
  const results: NearestStationSummary[] = [];

  for (const [key, st] of Object.entries(network.stations)) {
    const firstPos = Object.values(st.at)[0];
    if (!firstPos) continue;
    const d = haversineMeters(point, firstPos);
    if (d <= maxMeters) {
      const distanceMeters = Math.round(d);
      const lines = Object.keys(st.at)
        .map((id) => graph.linesById.get(id))
        .filter((l): l is MetroLine => Boolean(l));
      results.push({
        stationKey: key,
        station: st,
        distanceMeters,
        walkMinutes: Math.max(1, Math.round(distanceMeters / 75)),
        lines,
        latLng: firstPos
      });
    }
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
}

/**
 * Calcola il percorso ottimale sulla rete metropolitana di Seul tra un punto di partenza
 * (Alloggio o Posizione GPS attuale) e una tappa di destinazione (Luogo di visita o Alloggio).
 */
export function computeMetroRoute(
  network: MetroNetwork,
  origin: MapLocation,
  destination: MapLocation,
  options: MetroRouteOptions = {}
): MetroRouteResult {
  const excluded = new Set(options.excludeLineIds ?? []);
  const pref = options.preference ?? 'fast';
  if (excluded.size === 0) return computeRoute(network, origin, destination, excluded, pref);

  const result = computeRoute(network, origin, destination, excluded, pref);
  if (!result.reachable && !result.originOutOfMetroCoverage) {
    // Se senza esclusioni il percorso esiste, il problema è proprio la linea evitata: lo si dice chiaramente
    const unrestricted = computeRoute(network, origin, destination, new Set(), pref);
    if (unrestricted.reachable) {
      const names = [...excluded]
        .map((id) => (id === AREX_LINE_ID ? "l'AREX" : `la linea ${network.lines.find((l) => l.id === id)?.it ?? id}`))
        .join(' e ');
      return {
        ...result,
        reasonIfUnreachable: `Senza ${names} non c'è un collegamento in metro tra questi due punti: il percorso esiste solo usandola. Riattivala per vederlo.`,
        excludedLineIds: [...excluded]
      };
    }
  }
  return { ...result, excludedLineIds: [...excluded] };
}

function computeRoute(
  network: MetroNetwork,
  origin: MapLocation,
  destination: MapLocation,
  excluded: Set<string>,
  preference: RoutePreference = 'fast'
): MetroRouteResult {
  const { transferExtra, walkMul } = ROUTE_PREFERENCE_PARAMS[preference];
  const graph = getOrBuildGraph(network);
  /** Una stazione serve se almeno una delle sue linee non è esclusa */
  const isServed = (st: MetroStation) => excluded.size === 0 || Object.keys(st.at).some((id) => !excluded.has(id));
  const originLatLng: LatLng = [origin.lat, origin.lng];
  const destLatLng: LatLng = [destination.lat, destination.lng];

  const nearestOriginOverall = findAbsoluteNearestStation(network, graph.linesById, originLatLng);
  const nearestDestOverall = findAbsoluteNearestStation(network, graph.linesById, destLatLng);

  // 0. Verifica se il punto di partenza (es. geolocalizzazione GPS del browser) è troppo distante da qualsiasi stazione metro
  const isGpsOrigin = origin.id === 'gps_origin';
  const maxOriginWalkM = isGpsOrigin ? MAX_GPS_ORIGIN_WALK_M : MAX_ORIGIN_WALK_M;

  const startCandidates: { stationKey: string; distMeters: number }[] = [];
  for (const [key, st] of Object.entries(network.stations)) {
    const pos = Object.values(st.at)[0];
    if (!pos || !isServed(st)) continue;
    const d = haversineMeters(originLatLng, pos);
    if (d <= maxOriginWalkM) {
      startCandidates.push({ stationKey: key, distMeters: d });
    }
  }

  if (startCandidates.length === 0) {
    const distKm = nearestOriginOverall
      ? (nearestOriginOverall.distanceMeters / 1000).toFixed(1).replace('.', ',')
      : '?';
    const nearestName = nearestOriginOverall
      ? `${nearestOriginOverall.station.en} (${nearestOriginOverall.station.ko}역)`
      : 'nessuna';
    return {
      reachable: false,
      origin,
      destination,
      originOutOfMetroCoverage: true,
      nearestOriginStation: nearestOriginOverall,
      nearestStationIfUnreachable: nearestOriginOverall,
      reasonIfUnreachable: `Al momento non ti trovi ancora in prossimità della rete metropolitana di Seul: la stazione metro più vicina alla tua posizione rilevata è ${nearestName}, a ${distKm} km di distanza.`,
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: 0,
      estimatedTotalMinutes: 0
    };
  }

  // Se la partenza e la destinazione coincidono o sono a meno di 120 metri l'una dall'altra
  const directOriginToDestMeters = Math.round(haversineMeters(originLatLng, destLatLng));
  if (origin.id === destination.id || directOriginToDestMeters <= 120) {
    const closestSt = nearestOriginOverall!;
    const directMinutes = Math.max(1, Math.round(directOriginToDestMeters / 75));
    return {
      reachable: true,
      origin,
      destination,
      nearestOriginStation: nearestOriginOverall,
      walkStart: {
        stationKey: closestSt.stationKey,
        station: closestSt.station,
        lineId: closestSt.lines[0]?.id ?? '2',
        distanceMeters: directOriginToDestMeters,
        walkMinutes: directMinutes,
        fromLatLng: originLatLng,
        toLatLng: destLatLng,
        note:
          origin.id === destination.id
            ? 'Il punto di partenza e la destinazione selezionata coincidono.'
            : 'Ti trovi già a pochissimi passi dalla destinazione: si raggiunge direttamente a piedi senza prendere la metro.'
      },
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: directOriginToDestMeters,
      estimatedTotalMinutes: directMinutes
    };
  }

  // Se la tappa è fuori dalla Corea (es. Pechino o Milano), mostra subito che non fa parte della rete metro coreana
  if (destination.city === 'Pechino' || destination.city === 'Milano') {
    return {
      reachable: false,
      origin,
      destination,
      nearestOriginStation: nearestOriginOverall,
      reasonIfUnreachable: `Questa tappa si trova a ${destination.city} ed è quindi fuori dalla rete metropolitana di Seul.`,
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: 0,
      estimatedTotalMinutes: 0
    };
  }

  // Controllo esplicito per tappe come la DMZ che non sono servite dalla metro
  if (UNREACHABLE_CUSTOM_REASONS[destination.id]) {
    return {
      reachable: false,
      origin,
      destination,
      nearestOriginStation: nearestOriginOverall,
      reasonIfUnreachable: UNREACHABLE_CUSTOM_REASONS[destination.id],
      nearestStationIfUnreachable: nearestDestOverall,
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: 0,
      estimatedTotalMinutes: 0
    };
  }

  const extendedDest = EXTENDED_WALK_DESTINATIONS[destination.id];
  const maxDestWalkM = extendedDest ? extendedDest.maxMeters : DEFAULT_MAX_DEST_WALK_M;

  // 2. Trova le stazioni candidate attorno alla tappa di destinazione
  const endCandidates = new Map<string, number>();
  for (const [key, st] of Object.entries(network.stations)) {
    const pos = Object.values(st.at)[0];
    if (!pos || !isServed(st)) continue;
    const d = haversineMeters(destLatLng, pos);
    if (d <= maxDestWalkM) {
      endCandidates.set(key, d);
    }
  }

  if (endCandidates.size === 0) {
    const distKm = nearestDestOverall ? (nearestDestOverall.distanceMeters / 1000).toFixed(1).replace('.', ',') : '?';
    const nearestName = nearestDestOverall ? `${nearestDestOverall.station.en} (${nearestDestOverall.station.ko})` : 'nessuna';
    return {
      reachable: false,
      origin,
      destination,
      nearestOriginStation: nearestOriginOverall,
      reasonIfUnreachable: `Nessuna stazione della metropolitana si trova a distanza percorribile a piedi da questa tappa (la stazione più vicina è ${nearestName} a ${distKm} km). Si consiglia di utilizzare bus o taxi.`,
      nearestStationIfUnreachable: nearestDestOverall,
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: 0,
      estimatedTotalMinutes: 0
    };
  }

  // 3. Dijkstra bilanciato tra meno cambi, meno fermate e distanza a piedi
  // Costo camminata: 1 unità ogni 135 metri (~1,7 min a piedi), così una stazione a 500m diretta
  // viene preferita rispetto a una a 250m che richiede un cambio di linea (costo 5.5).
  const WALK_COST_DIVISOR = 135 / walkMul;

  const dist = new Map<string, number>();
  const prev = new Map<string, { fromNode: string; edge: GraphEdge }>();
  const startStationOfNode = new Map<string, { stationKey: string; walkMeters: number }>();

  // Coda di priorità semplice e veloce (il grafo ha ~900 nodi)
  const queue: { nodeId: string; cost: number }[] = [];
  const pushQueue = (nodeId: string, cost: number) => {
    queue.push({ nodeId, cost });
    queue.sort((a, b) => a.cost - b.cost);
  };

  for (const cand of startCandidates) {
    const stNodes = graph.nodesByStation.get(cand.stationKey) ?? [];
    const initialCost = cand.distMeters / WALK_COST_DIVISOR;
    for (const meta of stNodes) {
      if (excluded.has(meta.lineId)) continue;
      const prevCost = dist.get(meta.nodeId);
      if (prevCost === undefined || initialCost < prevCost) {
        dist.set(meta.nodeId, initialCost);
        startStationOfNode.set(meta.nodeId, { stationKey: cand.stationKey, walkMeters: cand.distMeters });
        pushQueue(meta.nodeId, initialCost);
      }
    }
  }

  let bestEndNode: string | null = null;
  let bestTotalCost = Infinity;
  let bestEndWalkMeters = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentBest = dist.get(current.nodeId);
    if (currentBest === undefined || current.cost > currentBest) continue;
    if (current.cost >= bestTotalCost) break;

    const meta = graph.nodes.get(current.nodeId)!;
    const endWalk = endCandidates.get(meta.stationKey);
    if (endWalk !== undefined) {
      const totalWithEndWalk = current.cost + endWalk / WALK_COST_DIVISOR;
      if (totalWithEndWalk < bestTotalCost) {
        bestTotalCost = totalWithEndWalk;
        bestEndNode = current.nodeId;
        bestEndWalkMeters = endWalk;
      }
    }

    const edges = graph.adj.get(current.nodeId) ?? [];
    for (const edge of edges) {
      if (excluded.has(edge.lineId)) continue;
      const nextCost = current.cost + edge.cost + (edge.kind === 'transfer' ? transferExtra : 0);
      const known = dist.get(edge.toNode);
      if (known === undefined || nextCost < known) {
        dist.set(edge.toNode, nextCost);
        prev.set(edge.toNode, { fromNode: current.nodeId, edge });
        startStationOfNode.set(edge.toNode, startStationOfNode.get(current.nodeId)!);
        pushQueue(edge.toNode, nextCost);
      }
    }
  }

  if (!bestEndNode) {
    return {
      reachable: false,
      origin,
      destination,
      nearestOriginStation: nearestOriginOverall,
      reasonIfUnreachable: 'Non è stato possibile trovare una connessione valida sulla rete metropolitana tra il punto di partenza e questa tappa.',
      nearestStationIfUnreachable: nearestDestOverall,
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: 0,
      estimatedTotalMinutes: 0
    };
  }

  // 4. Ricostruzione della sequenza di archi
  const rawSteps: { fromNode: NodeMeta; toNode: NodeMeta; edge: GraphEdge }[] = [];
  let cursor = bestEndNode;
  while (prev.has(cursor)) {
    const step = prev.get(cursor)!;
    rawSteps.push({
      fromNode: graph.nodes.get(step.fromNode)!,
      toNode: graph.nodes.get(cursor)!,
      edge: step.edge
    });
    cursor = step.fromNode;
  }
  rawSteps.reverse();

  // Rimuoviamo eventuali cambi di linea superflui in partenza o arrivo (se il cammino inizia/finisce con un transfer)
  while (rawSteps.length > 0 && rawSteps[0].edge.kind !== 'ride') {
    rawSteps.shift();
  }
  while (rawSteps.length > 0 && rawSteps[rawSteps.length - 1].edge.kind !== 'ride') {
    rawSteps.pop();
  }

  // Caso particolare: la stazione di partenza e di arrivo coincidono (0 fermate metro, si va direttamente a piedi)
  if (rawSteps.length === 0) {
    const startMeta = graph.nodes.get(bestEndNode)!;
    const st = network.stations[startMeta.stationKey];
    const stPos = st.at[startMeta.lineId] ?? Object.values(st.at)[0];
    const directMeters = Math.round(haversineMeters(originLatLng, destLatLng));
    const directMinutes = Math.max(2, Math.round(directMeters / 75));
    return {
      reachable: true,
      origin,
      destination,
      walkStart: {
        stationKey: startMeta.stationKey,
        station: st,
        lineId: startMeta.lineId,
        distanceMeters: directMeters,
        walkMinutes: directMinutes,
        fromLatLng: originLatLng,
        toLatLng: destLatLng,
        note: 'La tappa è vicinissima all\'alloggio: si raggiunge direttamente a piedi senza prendere la metro.'
      },
      walkEnd: {
        stationKey: startMeta.stationKey,
        station: st,
        lineId: startMeta.lineId,
        distanceMeters: 0,
        walkMinutes: 0,
        fromLatLng: stPos,
        toLatLng: destLatLng
      },
      segments: [],
      transfers: [],
      totalStops: 0,
      totalTransfers: 0,
      totalWalkMeters: directMeters,
      estimatedTotalMinutes: directMinutes
    };
  }

  // 5. Raggruppa gli hop 'ride' in segmenti continui (unendo eventuali 'branch-through' sulla stessa linea)
  interface RideHop {
    fromMeta: NodeMeta;
    toMeta: NodeMeta;
    edge: GraphEdge;
  }

  const groupedRides: RideHop[][] = [];
  let currentGroup: RideHop[] = [];

  for (const step of rawSteps) {
    if (step.edge.kind === 'ride') {
      currentGroup.push({ fromMeta: step.fromNode, toMeta: step.toNode, edge: step.edge });
    } else if (step.edge.kind === 'branch-through') {
      // Continua sullo stesso treno lungo la diramazione passante (es. Linea 1 a Guro)
      continue;
    } else if (step.edge.kind === 'transfer') {
      if (currentGroup.length > 0) {
        groupedRides.push(currentGroup);
        currentGroup = [];
      }
    }
  }
  if (currentGroup.length > 0) {
    groupedRides.push(currentGroup);
  }

  const segments: MetroRouteSegment[] = [];
  const transfers: MetroTransferInfo[] = [];

  for (let sIdx = 0; sIdx < groupedRides.length; sIdx++) {
    const hops = groupedRides[sIdx];
    const firstHop = hops[0];
    const lastHop = hops[hops.length - 1];
    const line = graph.linesById.get(firstHop.edge.lineId)!;

    const fromStationKey = firstHop.fromMeta.stationKey;
    const toStationKey = lastHop.toMeta.stationKey;
    const fromStation = network.stations[fromStationKey];
    const toStation = network.stations[toStationKey];

    const intermediateStationKeys = hops.slice(0, -1).map((h) => h.toMeta.stationKey);
    const intermediateStations = intermediateStationKeys.map((k) => network.stations[k]);

    // Costruisce la geometria completa concatenando i singoli hop
    const pathGeometry: LatLng[] = [];
    for (const h of hops) {
      const chain = line.chains[h.edge.chainIndex];
      const hopPts = extractHopGeometry(chain, h.edge.fromStationIdx!, h.edge.toStationIdx!, h.edge.dir!);
      if (pathGeometry.length === 0) {
        pathGeometry.push(...hopPts);
      } else {
        pathGeometry.push(...hopPts.slice(1));
      }
    }

    const dirInfo = getDirectionInfo(
      network,
      line,
      firstHop.edge.chainIndex,
      firstHop.edge.fromStationIdx!,
      firstHop.edge.toStationIdx!,
      toStationKey,
      firstHop.edge.dir!
    );

    const stopCount = hops.length;
    // Tempo medio in treno: ~2,1 min a fermata + 2 min attesa iniziale
    const estimatedMinutes = Math.max(2, Math.round(stopCount * 2.1));

    // Controlla se il segmento usa una diramazione specifica
    const branchLabel =
      getBranchLabel(line, lastHop.edge.chainIndex) ?? getBranchLabel(line, firstHop.edge.chainIndex);

    segments.push({
      line,
      branchLabel,
      fromStationKey,
      fromStation,
      toStationKey,
      toStation,
      intermediateStationKeys,
      intermediateStations,
      stopCount,
      estimatedMinutes,
      ...dirInfo,
      pathGeometry
    });

    if (sIdx > 0) {
      const prevSeg = segments[sIdx - 1];
      const trStationKey = fromStationKey;
      const trStation = network.stations[trStationKey];
      const trPos =
        trStation.at[line.id] ?? trStation.at[prevSeg.line.id] ?? Object.values(trStation.at)[0];
      transfers.push({
        stationKey: trStationKey,
        station: trStation,
        fromLine: prevSeg.line,
        toLine: line,
        isSameLineBranchChange: prevSeg.line.id === line.id,
        latLng: trPos
      });
    }
  }

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const boardPos =
    firstSeg.fromStation.at[firstSeg.line.id] ?? Object.values(firstSeg.fromStation.at)[0];
  const alightPos =
    lastSeg.toStation.at[lastSeg.line.id] ?? Object.values(lastSeg.toStation.at)[0];

  const startWalkMeters = Math.round(haversineMeters(originLatLng, boardPos));
  const endWalkMeters = Math.round(bestEndWalkMeters || haversineMeters(alightPos, destLatLng));

  // Velocità media pedonale urbana ~75 m/min
  const startWalkMinutes = Math.max(1, Math.round(startWalkMeters / 75));
  const endWalkMinutes = Math.max(1, Math.round(endWalkMeters / 75));

  const totalStops = segments.reduce((acc, s) => acc + s.stopCount, 0);
  const totalTransfers = transfers.length;
  const totalWalkMeters = startWalkMeters + endWalkMeters;
  const rideMinutes = segments.reduce((acc, s) => acc + s.estimatedMinutes, 0);
  const transferMinutes = totalTransfers * 4; // ~4 min per cambio banchina
  const estimatedTotalMinutes = startWalkMinutes + rideMinutes + transferMinutes + endWalkMinutes;

  return {
    reachable: true,
    origin,
    destination,
    nearestOriginStation: nearestOriginOverall,
    walkStart: {
      stationKey: firstSeg.fromStationKey,
      station: firstSeg.fromStation,
      lineId: firstSeg.line.id,
      distanceMeters: startWalkMeters,
      walkMinutes: startWalkMinutes,
      fromLatLng: originLatLng,
      toLatLng: boardPos
    },
    walkEnd: {
      stationKey: lastSeg.toStationKey,
      station: lastSeg.toStation,
      lineId: lastSeg.line.id,
      distanceMeters: endWalkMeters,
      walkMinutes: endWalkMinutes,
      fromLatLng: alightPos,
      toLatLng: destLatLng,
      note: extendedDest?.note
    },
    segments,
    transfers,
    totalStops,
    totalTransfers,
    totalWalkMeters,
    estimatedTotalMinutes
  };
}

/**
 * Confronta tutti i 4 alloggi Enko Stay rispetto a una specifica tappa di destinazione.
 */
export function compareAccommodationsForDestination(
  network: MetroNetwork,
  accommodations: MapLocation[],
  destination: MapLocation,
  options: MetroRouteOptions = {}
): MetroRouteResult[] {
  return accommodations.map((acc) => computeMetroRoute(network, acc, destination, options));
}
