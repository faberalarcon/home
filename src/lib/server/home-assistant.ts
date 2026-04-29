import { env } from '$env/dynamic/private';

const HA_TIMEOUT = 5000;

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface HAHistoryEntry {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated?: string;
  attributes?: Record<string, unknown>;
}

interface HAHistoryOptions {
  minimalResponse?: boolean;
  noAttributes?: boolean;
  significantChangesOnly?: boolean;
}

export interface HAStatisticPoint {
  start: string;
  end: string;
  state?: number;
  sum?: number;
  change?: number;
  mean?: number;
  min?: number;
  max?: number;
}

interface HAStatisticsResponse {
  service_response?: {
    statistics?: Record<string, HAStatisticPoint[]>;
  };
}

function getConfig() {
  const baseUrl = env.HA_BASE_URL || 'http://ai.local:8123';
  const token = env.HA_TOKEN || '';
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

async function haFetch<T>(path: string): Promise<T> {
  const { baseUrl, token } = getConfig();
  if (!token) throw new Error('HA_TOKEN not configured');

  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(HA_TIMEOUT)
  });

  if (!res.ok) {
    throw new Error(`HA API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function haPost<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl, token } = getConfig();
  if (!token) throw new Error('HA_TOKEN not configured');

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HA_TIMEOUT)
  });

  if (!res.ok) {
    throw new Error(`HA API ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function getState(entityId: string): Promise<HAState> {
  return haFetch<HAState>(`/api/states/${entityId}`);
}

export async function getStates(entityIds: string[]): Promise<Map<string, HAState>> {
  const results = await Promise.allSettled(entityIds.map((id) => getState(id)));
  const map = new Map<string, HAState>();
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      map.set(entityIds[i], result.value);
    }
  });
  return map;
}

export async function getHistory(
  entityId: string,
  startTime: Date,
  endTime?: Date,
  options: HAHistoryOptions = {}
): Promise<HAHistoryEntry[]> {
  const {
    minimalResponse = true,
    noAttributes = true,
    significantChangesOnly
  } = options;
  const start = startTime.toISOString();
  const params = [`filter_entity_id=${encodeURIComponent(entityId)}`];
  if (minimalResponse) params.push('minimal_response');
  if (noAttributes) params.push('no_attributes');
  if (significantChangesOnly === false) params.push('significant_changes_only=0');
  if (endTime) {
    params.push(`end_time=${encodeURIComponent(endTime.toISOString())}`);
  }

  const path = `/api/history/period/${start}?${params.join('&')}`;
  const data = await haFetch<HAHistoryEntry[][]>(path);
  return data[0] ?? [];
}

export async function getStatistics(
  entityIds: string[],
  startTime: Date,
  endTime: Date,
  period: '5minute' | 'hour' | 'day' | 'week' | 'month',
  types: Array<'change' | 'last_reset' | 'max' | 'mean' | 'min' | 'state' | 'sum'>
): Promise<Record<string, HAStatisticPoint[]>> {
  const data = await haPost<HAStatisticsResponse>('/api/services/recorder/get_statistics?return_response', {
    statistic_ids: entityIds,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    period,
    types
  });

  return data.service_response?.statistics ?? {};
}

export async function isAvailable(): Promise<boolean> {
  try {
    await haFetch('/api/');
    return true;
  } catch {
    return false;
  }
}

// Entity IDs we care about
export const ENTITIES = {
  indoorTemp: 'sensor.living_room_thermostat_temperature',
  humidity: 'sensor.living_room_thermostat_humidity',
  hvacMode: 'climate.living_room_thermostat',
  outdoorTemp: 'sensor.blink_backyard_temperature',
  livingRoomTV: 'media_player.goobytv_2',
  bedroomTV: 'media_player.bedroom_tv',
  xbox: 'media_player.bedroom_xbox',
  gamerscore: 'sensor.faberali_gamerscore',
  nowPlaying: 'sensor.faberali_now_playing',
  downloadSpeed: 'sensor.exos_router_download_speed',
  uploadSpeed: 'sensor.exos_router_upload_speed',
  alarm: 'alarm_control_panel.blink_faber_home',
  weather: 'weather.forecast_home',
  sun: 'sun.sun',
  sunrise: 'sensor.sun_next_rising',
  sunset: 'sensor.sun_next_setting',
  wallConnectorVehicleConnected: 'binary_sensor.tesla_wall_connector_vehicle_connected',
  wallConnectorContactorClosed: 'binary_sensor.tesla_wall_connector_contactor_closed',
  wallConnectorStatus: 'sensor.tesla_wall_connector_status',
  wallConnectorHandleTemp: 'sensor.tesla_wall_connector_handle_temperature',
  wallConnectorPcbTemp: 'sensor.tesla_wall_connector_pcb_temperature',
  wallConnectorMcuTemp: 'sensor.tesla_wall_connector_mcu_temperature',
  wallConnectorGridVoltage: 'sensor.tesla_wall_connector_grid_voltage',
  wallConnectorPhaseACurrent: 'sensor.tesla_wall_connector_phase_a_current',
  wallConnectorPhaseBCurrent: 'sensor.tesla_wall_connector_phase_b_current',
  wallConnectorPhaseCCurrent: 'sensor.tesla_wall_connector_phase_c_current',
  wallConnectorTotalPower: 'sensor.tesla_wall_connector_total_power',
  wallConnectorSessionEnergy: 'sensor.tesla_wall_connector_session_energy',
  wallConnectorEnergy: 'sensor.tesla_wall_connector_energy'
} as const;

export type EntityKey = keyof typeof ENTITIES;
