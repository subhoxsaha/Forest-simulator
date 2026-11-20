/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from 'three';

export type WildlifeSpeciesId =
  | 'deer'
  | 'fox'
  | 'rabbit'
  | 'squirrel'
  | 'songbird'
  | 'koi'
  | 'duck'
  | 'hawk'
  | 'owl';

export interface SpeciesProfile {
  speciesId: WildlifeSpeciesId;
  name: string;
  scientificName: string;
  habitat: string;
  diet: string;
  accentColor: string;
  fact: string;
  speedLabel: string;
}

export const SPECIES_PROFILES: Record<WildlifeSpeciesId, SpeciesProfile> = {
  deer: {
    speciesId: 'deer',
    name: 'Forest Deer',
    scientificName: 'Cervus sylvestris',
    habitat: 'Woodland Glades',
    diet: 'Herbivore',
    accentColor: '#d97706',
    fact: 'Grazes peacefully in sunlit clearings and retreats beneath tall canopies at dusk.',
    speedLabel: 'Graceful Stride',
  },
  fox: {
    speciesId: 'fox',
    name: 'Woodland Fox',
    scientificName: 'Vulpes rufus',
    habitat: 'Forest Edge & Trails',
    diet: 'Omnivore',
    accentColor: '#ea580c',
    fact: 'Agile twilight wanderer whose thick russet coat keeps it active even through winter snow.',
    speedLabel: 'Swift Trot',
  },
  rabbit: {
    speciesId: 'rabbit',
    name: 'Cottontail Rabbit',
    scientificName: 'Sylvilagus floridanus',
    habitat: 'Sunlit Meadows',
    diet: 'Herbivore',
    accentColor: '#f8fafc',
    fact: 'Bounds across soft grass clearings in springy arcs, foraging tender clover and shoots.',
    speedLabel: 'Bouncy Hop',
  },
  squirrel: {
    speciesId: 'squirrel',
    name: 'Red Squirrel',
    scientificName: 'Sciurus vulgaris',
    habitat: 'Tree Trunks & Roots',
    diet: 'Forager',
    accentColor: '#f59e0b',
    fact: 'Scampers rapidly between oaks and pines, caching acorns and helping disperse wild seeds.',
    speedLabel: 'Nimble Dash',
  },
  songbird: {
    speciesId: 'songbird',
    name: 'Canopy Songbird',
    scientificName: 'Cyanocitta & Spinus',
    habitat: 'Upper Branches',
    diet: 'Seeds & Insects',
    accentColor: '#38bdf8',
    fact: 'Flits from crown to crown singing dawn melodies before roosting safely in leaves at night.',
    speedLabel: 'Darting Flight',
  },
  koi: {
    speciesId: 'koi',
    name: 'River Koi',
    scientificName: 'Cyprinus rubrofuscus',
    habitat: 'Flowing Stream',
    diet: 'Aquatic Omnivore',
    accentColor: '#fb923c',
    fact: 'Glides along cool riverbed currents beneath dappled water light, slowing calmly in winter.',
    speedLabel: 'Fluid Swim',
  },
  duck: {
    speciesId: 'duck',
    name: 'Mallard Duck',
    scientificName: 'Anas platyrhynchos',
    habitat: 'River & Shorebanks',
    diet: 'Omnivore',
    accentColor: '#10b981',
    fact: 'Paddles smoothly across stream bends, periodically dipping beneath ripples to forage.',
    speedLabel: 'Steady Paddle',
  },
  hawk: {
    speciesId: 'hawk',
    name: 'Forest Hawk',
    scientificName: 'Buteo jamaicensis',
    habitat: 'High Thermals',
    diet: 'Raptor',
    accentColor: '#b45309',
    fact: 'Circles effortlessly on warm daytime updrafts watching over mature woodland canopies.',
    speedLabel: 'Thermal Soar',
  },
  owl: {
    speciesId: 'owl',
    name: 'Moonlit Owl',
    scientificName: 'Strix varia',
    habitat: 'Nocturnal Canopy',
    diet: 'Nocturnal Raptor',
    accentColor: '#cbd5e1',
    fact: 'Emerges silently at dusk to patrol moonlit treetops with whisper-quiet wingbeats.',
    speedLabel: 'Silent Glide',
  },
};

export interface TrackedAnimalEntry {
  id: string;
  speciesId: WildlifeSpeciesId;
  active: boolean;
  pos: THREE.Vector3;
  yaw: number;
  activity: string;
  controllable: boolean;
}

export interface ControlInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

/**
 * Zero-rerender live registry of all 3D living creatures for Wildlife Camera tracking
 * and direct player animal control.
 */
class WildlifeTracker {
  private animals = new Map<string, TrackedAnimalEntry>();

  public trackedAnimalId: string | null = null;
  public controlledAnimalId: string | null = null;

  // Camera-relative horizontal basis vectors updated each frame by CameraRig
  public camForwardX = -0.707;
  public camForwardZ = -0.707;
  public camRightX = 0.707;
  public camRightZ = -0.707;

  // Current camera focus target in world space (used to find nearest creature)
  public camTargetX = 0;
  public camTargetZ = 0;

  public input: ControlInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
  };

  public upsert(
    id: string,
    speciesId: WildlifeSpeciesId,
    x: number,
    y: number,
    z: number,
    yaw: number,
    active: boolean,
    activity: string,
    controllable = true
  ) {
    let entry = this.animals.get(id);
    if (!entry) {
      entry = {
        id,
        speciesId,
        active,
        pos: new THREE.Vector3(x, y, z),
        yaw,
        activity,
        controllable,
      };
      this.animals.set(id, entry);
    } else {
      entry.active = active;
      entry.pos.set(x, y, z);
      entry.yaw = yaw;
      entry.activity = activity;
    }
  }

  public remove(id: string) {
    this.animals.delete(id);
  }

  public getAnimal(id: string | null): TrackedAnimalEntry | null {
    if (!id) return null;
    const entry = this.animals.get(id);
    return entry && entry.active ? entry : null;
  }

  public getActiveAnimals(): TrackedAnimalEntry[] {
    const list: TrackedAnimalEntry[] = [];
    this.animals.forEach((a) => {
      if (a.active) list.push(a);
    });
    return list;
  }

  public findNearestAnimal(worldX = this.camTargetX, worldZ = this.camTargetZ): TrackedAnimalEntry | null {
    let best: TrackedAnimalEntry | null = null;
    let bestDistSq = Infinity;

    this.animals.forEach((a) => {
      if (!a.active) return;
      const dx = a.pos.x - worldX;
      const dz = a.pos.z - worldZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = a;
      }
    });

    return best;
  }

  public cycleAnimal(currentId: string | null, dir: 1 | -1): TrackedAnimalEntry | null {
    const active = this.getActiveAnimals();
    if (active.length === 0) return null;
    active.sort((a, b) => a.id.localeCompare(b.id));
    const idx = currentId ? active.findIndex((a) => a.id === currentId) : -1;
    if (idx === -1) return active[0];
    const nextIdx = (idx + dir + active.length) % active.length;
    return active[nextIdx];
  }

  public setCameraBasis(fx: number, fz: number, rx: number, rz: number, tx: number, tz: number) {
    this.camForwardX = fx;
    this.camForwardZ = fz;
    this.camRightX = rx;
    this.camRightZ = rz;
    this.camTargetX = tx;
    this.camTargetZ = tz;
  }

  public clearInput() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.boost = false;
  }

  /**
   * Computes camera-relative XZ movement vector from current input state.
   */
  public getMoveVector(): { mx: number; mz: number; moving: boolean } {
    const f = (this.input.forward ? 1 : 0) - (this.input.backward ? 1 : 0);
    const r = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (f === 0 && r === 0) return { mx: 0, mz: 0, moving: false };

    let mx = this.camForwardX * f + this.camRightX * r;
    let mz = this.camForwardZ * f + this.camRightZ * r;
    const len = Math.hypot(mx, mz);
    if (len > 1e-5) {
      mx /= len;
      mz /= len;
    }
    return { mx, mz, moving: true };
  }
}

export const wildlifeTracker = new WildlifeTracker();
