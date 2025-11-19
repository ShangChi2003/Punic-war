import { Faction, GameNode, NodeType } from './types';

// Map scaling: width 1000, height 600 effectively
export const INITIAL_GOLD = 800; // Slightly higher start gold
export const MAX_FORTIFICATION = 3;
export const FORTIFY_COST = 150;

export const WINTER_START_DAY = 300; 
export const AUTUMN_START_DAY = 240; // When Gold is collected
export const WINTER_DURATION = 65;
export const DAY_TICK_MS = 150; // Slower tick for better control
export const MOVEMENT_SPEED = 4; // Progress per tick
export const TRAINING_SPEED = 5; // Progress per tick
export const DAILY_TRADE_INCOME = 2; // Gold per day per owned Sea Zone

export const UNIT_COST = {
  ARMY: { gold: 100, manpower: 200 },
  FLEET: { gold: 200, manpower: 100 }
};

export const UNIT_STRENGTH = {
  ARMY: 100,
  FLEET: 100
};

// Helper to create node with defaults
const createNode = (data: Partial<GameNode> & { id: string, name: string, type: NodeType, x: number, y: number, owner: Faction, connections: string[] }): GameNode => ({
  income: 50,
  manpowerGrowth: 2,
  localManpower: 200,
  maxManpower: 1000,
  fortificationLevel: 0,
  ...data
});

// Define the Mediterranean Graph
export const INITIAL_NODES: Record<string, GameNode> = {
  // Italy
  'rome': createNode({ id: 'rome', name: 'Roma', type: NodeType.PORT, x: 55, y: 35, owner: Faction.ROME, income: 200, manpowerGrowth: 10, localManpower: 800, maxManpower: 2000, connections: ['capua', 'genoa', 'tyrrhenian_sea'], fortificationLevel: 1 }),
  'capua': createNode({ id: 'capua', name: 'Capua', type: NodeType.CITY, x: 60, y: 40, owner: Faction.ROME, income: 100, manpowerGrowth: 5, localManpower: 400, connections: ['rome', 'tarentum'] }),
  'tarentum': createNode({ id: 'tarentum', name: 'Tarentum', type: NodeType.PORT, x: 65, y: 45, owner: Faction.ROME, income: 80, manpowerGrowth: 5, localManpower: 400, connections: ['capua', 'ionian_sea'] }),
  'genoa': createNode({ id: 'genoa', name: 'Genua', type: NodeType.CITY, x: 48, y: 25, owner: Faction.ROME, income: 50, manpowerGrowth: 3, localManpower: 300, connections: ['rome', 'massilia', 'cisalpine_gaul'] }),
  'cisalpine_gaul': createNode({ id: 'cisalpine_gaul', name: 'Gallia Cis.', type: NodeType.CITY, x: 52, y: 18, owner: Faction.NEUTRAL, income: 40, manpowerGrowth: 8, localManpower: 500, connections: ['genoa'] }),

  // Sicily & Islands
  'syracuse': createNode({ id: 'syracuse', name: 'Syracusae', type: NodeType.PORT, x: 60, y: 60, owner: Faction.NEUTRAL, income: 150, manpowerGrowth: 5, localManpower: 500, connections: ['tyrrhenian_sea', 'ionian_sea', 'sicilian_strait'] }),
  'sardinia': createNode({ id: 'sardinia', name: 'Sardinia', type: NodeType.PORT, x: 40, y: 50, owner: Faction.NEUTRAL, income: 50, manpowerGrowth: 2, localManpower: 200, connections: ['tyrrhenian_sea', 'western_med'] }),

  // Africa
  'carthage': createNode({ id: 'carthage', name: 'Carthago', type: NodeType.PORT, x: 50, y: 70, owner: Faction.CARTHAGE, income: 250, manpowerGrowth: 8, localManpower: 800, maxManpower: 2000, connections: ['utica', 'sicilian_strait', 'western_med'], fortificationLevel: 1 }),
  'utica': createNode({ id: 'utica', name: 'Utica', type: NodeType.CITY, x: 45, y: 72, owner: Faction.CARTHAGE, income: 100, manpowerGrowth: 5, localManpower: 400, connections: ['carthage', 'cirta'] }),
  'cirta': createNode({ id: 'cirta', name: 'Cirta', type: NodeType.CITY, x: 35, y: 75, owner: Faction.NEUTRAL, income: 60, manpowerGrowth: 4, localManpower: 300, connections: ['utica', 'mauretania'] }),
  'mauretania': createNode({ id: 'mauretania', name: 'Mauretania', type: NodeType.CITY, x: 20, y: 72, owner: Faction.NEUTRAL, income: 40, manpowerGrowth: 6, localManpower: 400, connections: ['cirta', 'gades'] }),

  // Spain (Hispania)
  'nova_carthago': createNode({ id: 'nova_carthago', name: 'Nova Carthago', type: NodeType.PORT, x: 20, y: 60, owner: Faction.CARTHAGE, income: 180, manpowerGrowth: 6, localManpower: 500, connections: ['saguntum', 'western_med', 'gades'] }),
  'saguntum': createNode({ id: 'saguntum', name: 'Saguntum', type: NodeType.PORT, x: 22, y: 50, owner: Faction.NEUTRAL, income: 100, manpowerGrowth: 4, localManpower: 300, connections: ['nova_carthago', 'massilia', 'western_med'] }),
  'gades': createNode({ id: 'gades', name: 'Gades', type: NodeType.PORT, x: 10, y: 65, owner: Faction.NEUTRAL, income: 80, manpowerGrowth: 3, localManpower: 300, connections: ['nova_carthago', 'mauretania'] }),

  // Gaul
  'massilia': createNode({ id: 'massilia', name: 'Massilia', type: NodeType.PORT, x: 35, y: 30, owner: Faction.NEUTRAL, income: 120, manpowerGrowth: 4, localManpower: 400, connections: ['genoa', 'saguntum', 'western_med'] }),

  // Sea Zones (Income 0, Manpower 0)
  'tyrrhenian_sea': createNode({ id: 'tyrrhenian_sea', name: 'Tyrrhenian Sea', type: NodeType.SEA, x: 50, y: 45, owner: Faction.NEUTRAL, income: 0, manpowerGrowth: 0, localManpower: 0, connections: ['rome', 'syracuse', 'sardinia'] }),
  'western_med': createNode({ id: 'western_med', name: 'Western Med', type: NodeType.SEA, x: 30, y: 55, owner: Faction.NEUTRAL, income: 0, manpowerGrowth: 0, localManpower: 0, connections: ['massilia', 'saguntum', 'nova_carthago', 'sardinia', 'carthage'] }),
  'ionian_sea': createNode({ id: 'ionian_sea', name: 'Ionian Sea', type: NodeType.SEA, x: 75, y: 55, owner: Faction.NEUTRAL, income: 0, manpowerGrowth: 0, localManpower: 0, connections: ['tarentum', 'syracuse'] }),
  'sicilian_strait': createNode({ id: 'sicilian_strait', name: 'Sicilian Strait', type: NodeType.SEA, x: 55, y: 65, owner: Faction.NEUTRAL, income: 0, manpowerGrowth: 0, localManpower: 0, connections: ['carthage', 'syracuse'] }),
};