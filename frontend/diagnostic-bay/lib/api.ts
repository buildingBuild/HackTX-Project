export type Flags = { viz: boolean; loc: boolean; diag: boolean };

export type LogEntry = {
  method: string;
  path: string;
  status: number | string;
  ms: number;
  t0: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const CUSTOMER_IDS = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07'];

let log: LogEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => { log = [...log]; listeners.forEach((listener) => listener()); };

export const logStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => log,
};

async function request<T>(method: string, path: string, init?: RequestInit): Promise<T> {
  const entry: LogEntry = { method, path, status: '…', ms: 0, t0: performance.now() };
  log = [entry, ...log].slice(0, 12);
  emit();

  try {
    const response = await fetch(`${API_BASE}${path}`, init);
    entry.ms = Math.round(performance.now() - entry.t0);
    entry.status = response.status;
    emit();
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || `Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    entry.ms = Math.round(performance.now() - entry.t0);
    if (entry.status === '…') entry.status = 'ERR';
    emit();
    throw error;
  }
}

const VEHICLE_COLORS = ['#e9ecf0', '#aeb4bd', '#355b78', '#28313c', '#8d949d', '#b3202a', '#d6d9de'];

function vehicleFromModel(vehicleModel: string, mileage: number, index = 0) {
  const [year = '', make = '', model = '', ...trim] = vehicleModel.split(' ');
  const body = /sienna|escape|tucson|cx-5|rav4|highlander|odyssey|pacifica/i.test(vehicleModel) ? 'minivan' : 'sedan';
  return {
    year,
    make,
    model,
    trim: trim.join(' '),
    body,
    color: body === 'minivan' ? 'Silver' : 'Pearl White',
    hex: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
    odometerMi: mileage,
    label: vehicleModel,
  };
}

function customerView(customer: any, index = 0) {
  return {
    ...customer,
    vehicle: vehicleFromModel(customer.vehicle_model, customer.mileage, index),
  };
}

export const OBD: Record<string, { issueCode: string; vehicleModel: string; mileage: number }> = {
  c01: { issueCode: 'P0562', vehicleModel: '2016 Toyota Corolla LE', mileage: 84320 },
  c02: { issueCode: 'BODY-SCRATCH', vehicleModel: '2021 Toyota Camry SE', mileage: 51247 },
  c03: { issueCode: 'TPMS-LOW-PRESSURE', vehicleModel: '2018 Toyota Avalon XLE', mileage: 126804 },
  c04: { issueCode: 'B1650', vehicleModel: '2020 Toyota Camry SE', mileage: 67315 },
  c05: { issueCode: 'P0730', vehicleModel: '2019 Toyota Corolla SE', mileage: 91876 },
  c06: { issueCode: 'MAINT-OIL-LIFE', vehicleModel: '2022 Toyota Camry LE', mileage: 38942 },
  c07: { issueCode: 'C1391', vehicleModel: '2021 Toyota Avalon Limited', mileage: 76418 },
};

export const VIZ: Record<string, any> = {
  sedan: {
    bodyType: 'sedan', length: 4.88, width: 1.84, height: 1.445, wheelRadius: 0.34, frontAxle: 1.42, rearAxle: -1.4,
    top: [[-2.44, 0.7], [-2.36, 0.86], [-2.2, 0.96], [-1.7, 0.995], [-1.0, 0.99], [0.2, 0.99], [0.95, 0.985], [1.6, 0.93], [2.1, 0.86], [2.36, 0.76], [2.44, 0.6]],
    half: [[-2.44, 0.6], [-2.25, 0.92], [-1.9, 0.99], [-1.2, 1], [1.2, 1], [2.0, 0.975], [2.3, 0.9], [2.44, 0.62]],
    houseW: 0.84, cowl: 0.92, gFront: 0.18, gRear: -0.78, gBase: -1.38, roofY: 1.445,
    fbd: 0.5, rbd: 0.5, fbTop: 0.8, rbTop: 0.78, rocker: 0.44, doorStart: 0.98, doorMid: 0, doorEnd: -0.95, fuelX: -1.15, trunkLabel: 'Trunk',
  },
  minivan: {
    bodyType: 'minivan', length: 5.17, width: 1.99, height: 1.78, wheelRadius: 0.37, frontAxle: 1.55, rearAxle: -1.52,
    top: [[-2.585, 0.8], [-2.5, 0.96], [-2.3, 1.06], [-1.8, 1.09], [-0.5, 1.09], [0.6, 1.08], [1.2, 1.05], [1.8, 0.97], [2.25, 0.88], [2.5, 0.78], [2.585, 0.64]],
    half: [[-2.585, 0.66], [-2.4, 0.94], [-2.0, 0.995], [-1.2, 1], [1.5, 1], [2.1, 0.98], [2.4, 0.9], [2.585, 0.6]],
    houseW: 0.87, cowl: 1.2, gFront: 0.45, gRear: -2.15, gBase: -2.5, roofY: 1.78, tailVertical: true,
    fbd: 0.5, rbd: 0.55, fbTop: 0.82, rbTop: 0.78, rocker: 0.47, doorStart: 1.12, doorMid: 0.1, doorEnd: -1.08, fuelX: -1.75, trunkLabel: 'Liftgate',
  },
};

export const PARTS: Record<string, [string, string]> = {
  front_bumper: ['Front bumper', 'Body'], grille: ['Grille', 'Body'], hood: ['Hood', 'Body'],
  headlight_l: ['Left headlight', 'Lighting'], headlight_r: ['Right headlight', 'Lighting'],
  fender_fl: ['Front left fender', 'Body'], fender_fr: ['Front right fender', 'Body'],
  door_fl: ['Front left door', 'Body'], door_fr: ['Front right door', 'Body'], door_rl: ['Rear left door', 'Body'], door_rr: ['Rear right door', 'Body'],
  quarter_rl: ['Rear left quarter panel', 'Body'], quarter_rr: ['Rear right quarter panel', 'Body'],
  roof: ['Roof', 'Body'], glass: ['Windshield and glass', 'Glass'], trunk: ['Trunk', 'Body'], rear_bumper: ['Rear bumper', 'Body'],
  taillight_l: ['Left taillight', 'Lighting'], taillight_r: ['Right taillight', 'Lighting'],
  wheel_fl: ['Front left wheel', 'Wheels'], wheel_fr: ['Front right wheel', 'Wheels'], wheel_rl: ['Rear left wheel', 'Wheels'], wheel_rr: ['Rear right wheel', 'Wheels'],
  mirror_l: ['Left mirror', 'Body'], mirror_r: ['Right mirror', 'Body'], fuel_door: ['Fuel door', 'Body'],
};

const AFFECTED_PARTS: Record<string, string[]> = {
  P0562: ['hood'],
  'BODY-SCRATCH': ['door_fr'],
  'TPMS-LOW-PRESSURE': ['wheel_rl'],
  B1650: ['front_bumper'],
  P0730: ['hood'],
  'MAINT-OIL-LIFE': ['hood'],
  C1391: ['wheel_fl', 'wheel_fr'],
};

export function partName(id: string, spec?: any) {
  if (id === 'trunk' && spec) return spec.trunkLabel;
  return PARTS[id]?.[0] || id;
}

export const money = (value: number | null | undefined) => value == null
  ? 'Pending'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function diagnosticView(payload: any, customer: any, obd: any) {
  const affectedParts = AFFECTED_PARTS[obd.issueCode] || ['hood'];
  const dtcs = [{ code: obd.issueCode, desc: 'Vehicle diagnostic issue code', status: 'Active' }];

  if (payload.severity === 'low') {
    return {
      severity: 'low',
      headline: 'Helpful guidance is ready',
      summary: `The ${obd.issueCode} issue is low severity. Review the resources below before deciding on the next step.`,
      dtcs,
      findings: [{ partId: affectedParts[0], title: `Issue ${obd.issueCode}`, detail: 'The connected diagnostic profile marked this as a low-severity issue.' }],
      affectedParts,
      resources: {
        videos: (payload.resources?.videos || []).map((item: any) => ({ ...item, url: item.link })),
        articles: (payload.resources?.articles || []).map((item: any) => ({ ...item, url: item.link })),
      },
      nextSteps: ['Review the recommended resources.', 'Arrange service if the issue continues or becomes worse.'],
    };
  }

  const recommendation = payload.recommendations;
  const cost = recommendation.cost;
  const findings = recommendation.required_parts.length
    ? recommendation.required_parts.map((part: string, index: number) => ({
        partId: affectedParts[Math.min(index, affectedParts.length - 1)],
        title: part,
        detail: 'Required part identified by the diagnostic agent.',
      }))
    : [{ partId: affectedParts[0], title: `Issue ${obd.issueCode}`, detail: 'A technician must confirm the exact failed component.' }];

  return {
    severity: 'high',
    headline: recommendation.safe_to_drive ? 'Service needed soon' : 'Serious issue found',
    summary: recommendation.summary,
    dtcs,
    findings,
    affectedParts,
    safetyWarning: {
      title: recommendation.safe_to_drive ? 'Arrange service promptly' : 'Do not drive this vehicle',
      body: recommendation.recommendations[0] || recommendation.summary,
    },
    insurance: {
      plan: `${customer.insurance_level[0].toUpperCase()}${customer.insurance_level.slice(1)} coverage`,
      coverageStatus: recommendation.coverage_status,
      coverageNote: recommendation.coverage_explanation,
      deductible: cost.deductible,
      estimatedRepairCost: cost.estimated_repair_cost,
      customerCost: cost.estimated_customer_cost,
      insurancePayment: cost.estimated_insurance_payment,
      calculation: cost.calculation,
    },
    nextSteps: recommendation.recommendations,
    requiredParts: recommendation.required_parts,
  };
}

export const api = {
  async getCustomers() {
    const settled = await Promise.allSettled(
      CUSTOMER_IDS.map((id) => request<any>('GET', `/customers/${id}`)),
    );
    return settled.flatMap((result, index) => result.status === 'fulfilled' ? [customerView(result.value, index)] : []);
  },

  async postDiagnosticSession(customer: any, flags: Flags) {
    if (flags.diag) throw new Error('Demo diagnostic failure');
    const obd = OBD[customer.id];
    const payload = await request<any>('POST', '/diagnostic-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer.id,
        diagnostic: {
          issue_code: obd.issueCode,
          vehicle_model: obd.vehicleModel,
          mileage: obd.mileage,
        },
      }),
    });
    return diagnosticView(payload, customer, obd);
  },

  async getVehicleVisualization(customer: any, flags: Flags) {
    if (flags.viz) throw new Error('Demo visualization failure');
    const response = await request<any>('GET', `/3d-visualization/${customer.id}`);
    return {
      customerId: customer.id,
      label: customer.vehicle_model,
      // Backend model wins; otherwise sedans use the bundled Camry and SUVs/vans use the built-in van.
      modelUrl: response?.model_url || (customer.vehicle.body === 'sedan' ? '/models/camry.glb' : undefined),
      spec: { color: customer.vehicle.hex, ...VIZ[customer.vehicle.body] },
    };
  },

  async getServiceLocations(location: string, flags: Flags) {
    if (flags.loc) throw new Error('Demo location failure');
    const payload = await request<any>('GET', `/service-locations?location=${encodeURIComponent(location)}`);
    return payload.results.map((place: any, index: number) => ({
      id: `${place.latitude}-${place.longitude}-${index}`,
      name: place.name,
      type: 'dealership',
      distanceMi: place.distance_miles,
      phone: place.phone,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
  },
};
