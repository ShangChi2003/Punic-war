export enum Faction {
  ROME = 'ROME',
  CARTHAGE = 'CARTHAGE',
  NEUTRAL = 'NEUTRAL',
  SPECTATOR = 'SPECTATOR'
}

export enum NodeType {
  CITY = 'CITY',   // Can recruit Armies
  PORT = 'PORT',   // Can recruit Armies and Fleets
  SEA = 'SEA'      // Sea zone
}

export enum UnitType {
  LEGION = 'LEGION',       // Land unit (Rome)
  MERCENARY = 'MERCENARY', // Land unit (Carthage)
  FLEET = 'FLEET',         // Sea unit
}

export interface Point {
  x: number;
  y: number;
}

export interface GameNode {
  id: string;
  name: string;
  type: NodeType;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  owner: Faction;
  income: number; // Gold per year
  manpowerGrowth: number; // Manpower added per day
  localManpower: number; // Current manpower in this city
  maxManpower: number; // Cap
  connections: string[]; // IDs of connected nodes
  fortificationLevel: number; // 0 to 3
}

export interface Unit {
  id: string;
  owner: Faction;
  type: UnitType;
  strength: number; // Health/Damage
  maxStrength: number;
  locationId: string; // Current node ID
  destinationId: string | null; // Immediate Target node ID
  path: string[]; // Queue of future node IDs for multi-step movement
  originId: string; // Where it was recruited (for winter return)
  progress: number; // 0 to 100 travel progress
  isMoving: boolean;
  isTraining: boolean;
  trainingProgress: number; // 0 to 100
}

export interface GameState {
  nodes: Record<string, GameNode>;
  units: Unit[];
  playerFaction: Faction;
  resources: {
    gold: Record<Faction, number>;
    // Global manpower tracking is less relevant now, but kept for stats
    totalManpower: Record<Faction, number>;
  };
  day: number;
  isWinter: boolean;
  gameSpeed: number; // 0 = paused, 1 = normal
  selectedNodeId: string | null;
  isTargetingMode: boolean; // True when player clicked "Move" and needs to pick destination
  log: string[];
  gameOver: boolean;
  winner: Faction | null;
  mapImage: string | null; // Custom generated background
  startScreenImage: string | null; // Custom generated start screen
}