import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Faction, GameNode, GameState, NodeType, Unit, UnitType } from './types';
import { INITIAL_NODES, INITIAL_GOLD, WINTER_START_DAY, AUTUMN_START_DAY, WINTER_DURATION, DAY_TICK_MS, MOVEMENT_SPEED, TRAINING_SPEED, UNIT_COST, UNIT_STRENGTH, DAILY_TRADE_INCOME, FORTIFY_COST, MAX_FORTIFICATION } from './constants';
import { generateYearlyReport, generateBattleReport } from './services/geminiService';
import MapNode from './components/MapNode';
import GameUI from './components/GameUI';
import { Ship, Shield, Swords, Crown, Anchor, Image as ImageIcon, Loader, Eye } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

const App: React.FC = () => {
  // --- Initial State ---
  const [hasStarted, setHasStarted] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [isGeneratingStart, setIsGeneratingStart] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    nodes: JSON.parse(JSON.stringify(INITIAL_NODES)), // Deep copy
    units: [],
    playerFaction: Faction.ROME,
    resources: {
      gold: { [Faction.ROME]: INITIAL_GOLD, [Faction.CARTHAGE]: INITIAL_GOLD, [Faction.NEUTRAL]: 0, [Faction.SPECTATOR]: 0 },
      totalManpower: { [Faction.ROME]: 0, [Faction.CARTHAGE]: 0, [Faction.NEUTRAL]: 0, [Faction.SPECTATOR]: 0 }
    },
    day: 1,
    isWinter: false,
    gameSpeed: 1,
    selectedNodeId: null,
    isTargetingMode: false,
    log: ["Welcome, General. The Punic Wars begin."],
    gameOver: false,
    winner: null,
    mapImage: null,
    startScreenImage: null
  });

  const lastTickRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const stateRef = useRef<GameState>(gameState);

  // Keep ref in sync
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // --- Helpers ---
  
  const addLog = (msg: string) => {
    setGameState(prev => ({ ...prev, log: [...prev.log, msg] }));
  };

  const startGame = (faction: Faction) => {
    setGameState(prev => ({
      ...prev,
      playerFaction: faction,
      log: faction === Faction.SPECTATOR 
        ? ["Observing the conflict from the heavens."]
        : [`You have taken command of ${faction}. Conquer the Mediterranean!`]
    }));
    setHasStarted(true);
  };

  const generateStartBackground = async () => {
      if (!process.env.API_KEY) {
        alert("No API Key found.");
        return;
      }
      setIsGeneratingStart(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
            parts: [
                { text: 'An ancient roman mosaic depicting the Punic Wars between Rome and Carthage. Roman legions and Carthaginian elephants. Beige, brown, and red tiles. Classical artistic style, weathered stone texture. Horizontal orientation for a web background.' }
            ]
            },
            config: { responseModalities: [Modality.IMAGE] },
        });
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            const base64Image = `data:image/png;base64,${part.inlineData.data}`;
            setGameState(prev => ({ ...prev, startScreenImage: base64Image }));
        }
      } catch(e) {
          console.error(e);
          alert("Generation failed.");
      } finally {
          setIsGeneratingStart(false);
      }
  };

  const generateMapBackground = async () => {
    if (!process.env.API_KEY) {
      alert("No API Key found in environment variables.");
      return;
    }

    setIsGeneratingMap(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: 'A colorful cartoon style map of the Western Mediterranean for a strategy game. Clear outlines of Italy, Spain, and North Africa. Bright blue sea, distinct beige land masses. Simple, flat 2D design, top-down view. No text labels.' }
          ]
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part && part.inlineData) {
         const base64Image = `data:image/png;base64,${part.inlineData.data}`;
         setGameState(prev => ({ ...prev, mapImage: base64Image }));
      }
    } catch (e) {
      console.error("Map gen failed", e);
      alert("Failed to generate map. Using default.");
    } finally {
      setIsGeneratingMap(false);
    }
  };

  // --- Pathfinding (BFS) ---
  const findPath = (startId: string, endId: string, faction: Faction, currentState: GameState): string[] | null => {
     if (startId === endId) return [];

     const queue: { id: string, path: string[] }[] = [{ id: startId, path: [] }];
     const visited = new Set<string>([startId]);

     while (queue.length > 0) {
       const { id, path } = queue.shift()!;
       const node = currentState.nodes[id];

       if (id === endId) return path;

       for (const neighborId of node.connections) {
         if (!visited.has(neighborId)) {
            const neighbor = currentState.nodes[neighborId];
            
            // Naval Logic / Validity Check
            let canTraverse = true;

            // Land -> Sea check
            if (node.type !== NodeType.SEA && neighbor.type === NodeType.SEA) {
               // Needs friendly fleet in the SEA zone to board
               const hasFleet = currentState.units.some(u => u.locationId === neighborId && u.owner === faction && u.type === UnitType.FLEET);
               if (!hasFleet) canTraverse = false;
            }
            
            if (canTraverse) {
                visited.add(neighborId);
                queue.push({ id: neighborId, path: [...path, neighborId] });
            }
         }
       }
     }
     return null;
  };

  // --- Core Logic Functions ---

  const handleCombat = async (u1: Unit, u2: Unit, nodes: Record<string, GameNode>) => {
     // Naval Advantage in Sea
     const loc = nodes[u1.locationId];
     let u1Mod = 1;
     let u2Mod = 1;

     // Sea Bonuses
     if (loc.type === NodeType.SEA) {
        if (u1.type === UnitType.FLEET) u1Mod = 1.5;
        if (u2.type === UnitType.FLEET) u2Mod = 1.5;
     }

     // Fortification Defense Bonus
     if (loc.owner === u1.owner && loc.fortificationLevel > 0) {
         u1Mod += (loc.fortificationLevel * 0.5); // +50% per wall level
     }
     if (loc.owner === u2.owner && loc.fortificationLevel > 0) {
         u2Mod += (loc.fortificationLevel * 0.5);
     }

     const u1Roll = Math.random() * u1.strength * u1Mod;
     const u2Roll = Math.random() * u2.strength * u2Mod;
     
     let winner: Unit;
     let loser: Unit;

     if (u1Roll >= u2Roll) {
       winner = u1;
       loser = u2;
       winner.strength = Math.max(10, winner.strength - (20 / u1Mod)); 
     } else {
       winner = u2;
       loser = u1;
       winner.strength = Math.max(10, winner.strength - (20 / u2Mod));
     }

     const locName = nodes[winner.locationId]?.name || "Open Sea";
     const flavor = await generateBattleReport(locName, winner.owner, loser.owner);
     
     return { winner, loser, flavor };
  };

  const processAI = (currentState: GameState): { recruitments: Array<{nodeId: string, type: UnitType}>, moves: Array<{unitId: string, targetId: string}> } => {
    const aiFactions = currentState.playerFaction === Faction.SPECTATOR ? [Faction.ROME, Faction.CARTHAGE] : [currentState.playerFaction === Faction.ROME ? Faction.CARTHAGE : Faction.ROME];
    
    const recruitments: Array<{nodeId: string, type: UnitType}> = [];
    const moves: Array<{unitId: string, targetId: string}> = [];

    aiFactions.forEach(aiFaction => {
        const aiGold = currentState.resources.gold[aiFaction];
        const ownedNodes = Object.values(currentState.nodes).filter(n => n.owner === aiFaction);
        const unitCost = UNIT_COST.ARMY;

        // 1. Recruit
        if (aiGold > unitCost.gold && !currentState.isWinter) {
        const validNodes = ownedNodes.filter(n => n.localManpower >= unitCost.manpower);
        const targetNode = validNodes.find(n => currentState.units.filter(u => u.locationId === n.id).length < 2);
        
        if (targetNode) {
            if (targetNode.type === NodeType.PORT && Math.random() > 0.7) {
                recruitments.push({ nodeId: targetNode.id, type: UnitType.FLEET });
            } else if (targetNode.type !== NodeType.SEA) {
                recruitments.push({ nodeId: targetNode.id, type: UnitType.MERCENARY });
            }
        }
        }

        // 2. Move
        if (!currentState.isWinter) {
            const aiUnits = currentState.units.filter(u => u.owner === aiFaction && !u.isMoving && !u.isTraining && u.destinationId === null);
            aiUnits.forEach(unit => {
                const currentNode = currentState.nodes[unit.locationId];
                const neighbors = currentNode.connections;
                
                const validNeighbors = neighbors.filter(nid => {
                    const target = currentState.nodes[nid];
                    if (unit.type === UnitType.FLEET) {
                        return target.type === NodeType.SEA || target.type === NodeType.PORT;
                    } else {
                        if (target.type === NodeType.SEA) {
                            const friendlyFleet = currentState.units.some(u => u.locationId === nid && u.owner === aiFaction && u.type === UnitType.FLEET);
                            return friendlyFleet;
                        }
                        return true;
                    }
                });

                if (validNeighbors.length > 0) {
                    const enemy = validNeighbors.find(nid => currentState.nodes[nid].owner !== aiFaction && currentState.nodes[nid].owner !== Faction.NEUTRAL);
                    const neutral = validNeighbors.find(nid => currentState.nodes[nid].owner === Faction.NEUTRAL);
                    const target = enemy || neutral || validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
                    
                    if (Math.random() > 0.6) moves.push({ unitId: unit.id, targetId: target });
                }
            });
        }
    });

    return { recruitments, moves };
  };

  // --- Game Loop ---

  const updateGame = useCallback(async (dt: number) => {
    if (!hasStarted) return;
    
    const current = stateRef.current;
    if (current.gameSpeed === 0 || current.gameOver) return;

    let newState = { ...current };
    let events: string[] = [];
    
    // 1. Time & Season
    newState.day += 1;
    const dayOfYear = newState.day % 365;
    const wasWinter = newState.isWinter;
    newState.isWinter = dayOfYear >= WINTER_START_DAY || dayOfYear < (WINTER_START_DAY + WINTER_DURATION) % 365 && dayOfYear < WINTER_DURATION; 
    const isAutumn = dayOfYear === AUTUMN_START_DAY;

    if (wasWinter && !newState.isWinter) {
      events.push("Spring has arrived. The passes are clear.");
      if (newState.playerFaction !== Faction.SPECTATOR) {
          generateYearlyReport(newState).then(report => addLog(`[ORACLE] ${report}`));
      }
    } else if (!wasWinter && newState.isWinter) {
      events.push("Winter has fallen. Armies retreat to winter quarters.");
    }

    // 2. Resources
    Object.values(newState.nodes).forEach(node => {
        if (node.owner !== Faction.NEUTRAL) {
            if (node.localManpower < node.maxManpower) {
                node.localManpower = Math.min(node.maxManpower, node.localManpower + node.manpowerGrowth);
            }
        }
    });

    // Global Trade
    const romeTrade = (Object.values(newState.nodes) as GameNode[]).filter(n => n.owner === Faction.ROME && n.type === NodeType.SEA).length * DAILY_TRADE_INCOME;
    const carthageTrade = (Object.values(newState.nodes) as GameNode[]).filter(n => n.owner === Faction.CARTHAGE && n.type === NodeType.SEA).length * DAILY_TRADE_INCOME;
    newState.resources.gold[Faction.ROME] += romeTrade;
    newState.resources.gold[Faction.CARTHAGE] += carthageTrade;

    // Gold in Autumn
    if (isAutumn) {
        const romeGold = (Object.values(newState.nodes) as GameNode[]).filter(n => n.owner === Faction.ROME).reduce((sum, n) => sum + n.income, 0);
        const carthageGold = (Object.values(newState.nodes) as GameNode[]).filter(n => n.owner === Faction.CARTHAGE).reduce((sum, n) => sum + n.income, 0);
        
        newState.resources.gold[Faction.ROME] += romeGold;
        newState.resources.gold[Faction.CARTHAGE] += carthageGold;
        events.push("Taxes collected and Harvest gathered.");
    }

    // 3. Unit Logic
    const deadUnitIds: string[] = [];
    
    newState.units = newState.units.map(unit => {
        // Training
        if (unit.isTraining) {
            if (unit.trainingProgress >= 100) {
                return { ...unit, isTraining: false, trainingProgress: 100 };
            }
            return { ...unit, trainingProgress: unit.trainingProgress + TRAINING_SPEED };
        }

        // Winter Logic
        if (newState.isWinter) {
             if (unit.locationId !== unit.originId && !unit.isMoving && unit.type !== UnitType.FLEET) {
                 const currentLoc = newState.nodes[unit.locationId];
                 if (currentLoc.connections.includes(unit.originId)) {
                    return { ...unit, destinationId: unit.originId, path: [], isMoving: true, progress: 0 };
                 }
             }
        }

        // Movement
        if (unit.isMoving && unit.destinationId) {
            let newProgress = unit.progress + MOVEMENT_SPEED;
            if (newProgress >= 100) {
                // Arrived
                const nextNodeId = unit.destinationId;
                const remainingPath = unit.path ? [...unit.path] : [];
                const nextTarget = remainingPath.length > 0 ? remainingPath.shift() || null : null;

                return { 
                    ...unit, 
                    progress: 0, 
                    isMoving: !!nextTarget, 
                    locationId: nextNodeId, 
                    destinationId: nextTarget,
                    path: remainingPath
                };
            }
            return { ...unit, progress: newProgress };
        }

        return unit;
    });

    // 4. Arrival & Combat
    for (let i = 0; i < newState.units.length; i++) {
        const unit = newState.units[i];
        if (deadUnitIds.includes(unit.id)) continue;
        if (unit.isMoving || unit.isTraining) continue;

        const loc = newState.nodes[unit.locationId];
        const enemyUnits = newState.units.filter(u => u.locationId === unit.locationId && u.owner !== unit.owner && !deadUnitIds.includes(u.id) && !u.isTraining);

        if (enemyUnits.length > 0) {
             const enemy = enemyUnits[0];
             const { winner, loser, flavor } = await handleCombat(unit, enemy, newState.nodes);
             
             if (newState.playerFaction === Faction.SPECTATOR || winner.owner === newState.playerFaction || loser.owner === newState.playerFaction) {
                events.push(flavor);
             }
             deadUnitIds.push(loser.id);
             
             const winnerIndex = newState.units.findIndex(u => u.id === winner.id);
             if (winnerIndex !== -1) newState.units[winnerIndex].strength = winner.strength;

        } else {
            // Conquest
            if (loc.owner !== unit.owner) {
                const isLandConquest = loc.type !== NodeType.SEA && unit.type !== UnitType.FLEET;
                const isSeaConquest = loc.type === NodeType.SEA && unit.type === UnitType.FLEET;

                if (isLandConquest || isSeaConquest) {
                    newState.nodes[loc.id] = { ...loc, owner: unit.owner, fortificationLevel: 0 };
                    events.push(`${unit.owner} has seized control of ${loc.name}!`);
                    
                    if (loc.id === 'rome' && unit.owner === Faction.CARTHAGE) {
                        newState.gameOver = true;
                        newState.winner = Faction.CARTHAGE;
                    }
                    if (loc.id === 'carthage' && unit.owner === Faction.ROME) {
                        newState.gameOver = true;
                        newState.winner = Faction.ROME;
                    }
                }
            }
        }
    }

    newState.units = newState.units.filter(u => !deadUnitIds.includes(u.id));

    // 5. AI Actions
    if (newState.day % 20 === 0 && !newState.gameOver) {
        const aiActions = processAI(newState);
        
        aiActions.recruitments.forEach(rec => {
             // Need to infer owner from node or context. For simplicity, processAI handles both.
             const node = newState.nodes[rec.nodeId];
             const faction = node.owner; // Owner recruits at own base
             const cost = rec.type === UnitType.FLEET ? UNIT_COST.FLEET : UNIT_COST.ARMY;

             if (newState.resources.gold[faction] >= cost.gold && node.localManpower >= cost.manpower) {
                 newState.resources.gold[faction] -= cost.gold;
                 node.localManpower -= cost.manpower;
                 
                 newState.units.push({
                    id: uuidv4(),
                    owner: faction,
                    type: rec.type,
                    strength: UNIT_STRENGTH.ARMY,
                    maxStrength: UNIT_STRENGTH.ARMY,
                    locationId: rec.nodeId,
                    destinationId: null,
                    path: [],
                    originId: rec.nodeId,
                    progress: 0,
                    isMoving: false,
                    isTraining: true,
                    trainingProgress: 0
                 });
             }
        });

        aiActions.moves.forEach(move => {
             const unitIndex = newState.units.findIndex(u => u.id === move.unitId);
             if (unitIndex !== -1) {
                 newState.units[unitIndex].destinationId = move.targetId;
                 newState.units[unitIndex].isMoving = true;
             }
        });
    }

    if (events.length > 0) {
        newState.log = [...newState.log, ...events];
    }

    setGameState(newState);

  }, [hasStarted]);

  // --- Tick Loop ---
  useEffect(() => {
    const loop = (time: number) => {
      if (time - lastTickRef.current >= DAY_TICK_MS) {
         updateGame(time - lastTickRef.current);
         lastTickRef.current = time;
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateGame]);


  // --- Interaction Handlers ---

  const handleNodeClick = (nodeId: string) => {
    if (gameState.gameOver || !hasStarted || gameState.playerFaction === Faction.SPECTATOR) return;
    
    if (gameState.isTargetingMode && gameState.selectedNodeId) {
        const startNodeId = gameState.selectedNodeId;
        const path = findPath(startNodeId, nodeId, gameState.playerFaction, gameState);

        if (path && path.length > 0) {
            const readyUnits = gameState.units.filter(u => 
                u.locationId === startNodeId && 
                u.owner === gameState.playerFaction && 
                !u.isMoving && !u.isTraining
            );

            if (readyUnits.length > 0) {
                 const firstStep = path.shift()!; 
                 setGameState(prev => {
                    const newUnits = prev.units.map(u => {
                        if (readyUnits.some(r => r.id === u.id)) {
                            return { ...u, destinationId: firstStep, path: [...path], isMoving: true };
                        }
                        return u;
                    });
                    return { ...prev, units: newUnits, selectedNodeId: null, isTargetingMode: false };
                 });
                 addLog(`Moving forces to ${gameState.nodes[nodeId].name}.`);
            } else {
                setGameState(prev => ({ ...prev, isTargetingMode: false }));
            }
        } else {
            addLog("Invalid route.");
            setGameState(prev => ({ ...prev, isTargetingMode: false }));
        }
        return;
    }

    setGameState(prev => ({ 
        ...prev, 
        selectedNodeId: nodeId === prev.selectedNodeId ? null : nodeId,
        isTargetingMode: false 
    }));
  };

  const handleRecruit = (type: UnitType) => {
      if (!gameState.selectedNodeId || gameState.gameOver) return;
      const cost = type === UnitType.FLEET ? UNIT_COST.FLEET : UNIT_COST.ARMY;
      const playerGold = gameState.resources.gold[gameState.playerFaction];
      const node = gameState.nodes[gameState.selectedNodeId];

      if (playerGold >= cost.gold && node.localManpower >= cost.manpower) {
          setGameState(prev => {
              const newNodes = { ...prev.nodes };
              newNodes[node.id].localManpower -= cost.manpower;
              return {
                ...prev,
                nodes: newNodes,
                resources: { ...prev.resources, gold: { ...prev.resources.gold, [prev.playerFaction]: playerGold - cost.gold } },
                units: [...prev.units, {
                        id: uuidv4(),
                        owner: prev.playerFaction,
                        type: type,
                        strength: UNIT_STRENGTH.ARMY,
                        maxStrength: UNIT_STRENGTH.ARMY,
                        locationId: node.id,
                        destinationId: null,
                        path: [],
                        originId: node.id,
                        progress: 0,
                        isMoving: false,
                        isTraining: true,
                        trainingProgress: 0
                    }]
              };
          });
      }
  };

  const handleFortify = () => {
      if (!gameState.selectedNodeId) return;
      const node = gameState.nodes[gameState.selectedNodeId];
      const playerGold = gameState.resources.gold[gameState.playerFaction];

      if (playerGold >= FORTIFY_COST && node.fortificationLevel < MAX_FORTIFICATION) {
          setGameState(prev => {
              const newNodes = { ...prev.nodes };
              newNodes[node.id].fortificationLevel += 1;
              return {
                  ...prev,
                  nodes: newNodes,
                  resources: { ...prev.resources, gold: { ...prev.resources.gold, [prev.playerFaction]: playerGold - FORTIFY_COST }}
              };
          });
      }
  };

  const handleRally = () => {
      if (!gameState.selectedNodeId) return;
      const targetId = gameState.selectedNodeId;
      const faction = gameState.playerFaction;

      setGameState(prev => {
          const newUnits = prev.units.map(u => {
             if (u.owner !== faction || u.isMoving || u.isTraining || u.locationId === targetId) return u;
             if (u.type === UnitType.FLEET) return u; 

             const currentNode = prev.nodes[u.locationId];
             const hasEnemyNeighbor = currentNode.connections.some(connId => {
                 const neighbor = prev.nodes[connId];
                 return neighbor.owner !== faction && neighbor.owner !== Faction.NEUTRAL;
             });

             if (hasEnemyNeighbor) return u; 

             const path = findPath(u.locationId, targetId, faction, prev);
             if (path && path.length > 0) {
                 const firstStep = path.shift()!;
                 return { ...u, destinationId: firstStep, path: path, isMoving: true };
             }
             return u;
          });
          return { ...prev, units: newUnits };
      });
      addLog("Rallying reserves!");
  };

  const handleHalt = () => {
      if (!gameState.selectedNodeId) return;
      const targetId = gameState.selectedNodeId;
      
      // Cancel movement for all units currently destined for this node (final destination or immediate)
      // Actually, "Cancel Rally" usually implies stopping units coming *towards* this city.
      // We will find all friendly units moving, and if their final destination OR immediate destination is this node, stop them.
      
      setGameState(prev => {
          const newUnits = prev.units.map(u => {
              if (u.owner !== prev.playerFaction || !u.isMoving) return u;
              
              // Check path
              const isHeadedHere = u.destinationId === targetId || (u.path && u.path.includes(targetId));
              
              if (isHeadedHere) {
                  return {
                      ...u,
                      isMoving: false,
                      destinationId: null,
                      path: [],
                      progress: 0
                  };
              }
              return u;
          });
          return { ...prev, units: newUnits };
      });
      addLog("Incoming columns halted.");
  };

  const enterMoveMode = () => {
     if (gameState.isWinter) {
         addLog("Cannot launch campaigns in Winter!");
         return;
     }
     setGameState(prev => ({ ...prev, isTargetingMode: true }));
  };

  // --- Rendering Helpers ---

  const renderConnections = () => {
    const lines: React.ReactElement[] = [];
    const processed = new Set<string>();

    (Object.values(gameState.nodes) as GameNode[]).forEach(node => {
        node.connections.forEach(targetId => {
            const key = [node.id, targetId].sort().join('-');
            if (!processed.has(key)) {
                processed.add(key);
                const target = gameState.nodes[targetId];
                
                // Show path usage if units are moving between these nodes (for Spectator or Player)
                const isTraversed = gameState.units.some(u => 
                    ((u.locationId === node.id && u.destinationId === targetId) ||
                    (u.locationId === targetId && u.destinationId === node.id)) &&
                    (gameState.playerFaction === Faction.SPECTATOR || u.owner === gameState.playerFaction || (u.owner !== Faction.NEUTRAL && (u.locationId === gameState.selectedNodeId || targetId === gameState.selectedNodeId)))
                );
                
                const isSeaRoute = node.type === NodeType.SEA || target.type === NodeType.SEA;

                lines.push(
                    <line 
                        key={key}
                        x1={`${node.x}%`} y1={`${node.y}%`}
                        x2={`${target.x}%`} y2={`${target.y}%`}
                        stroke={isTraversed ? "#fbbf24" : "rgba(255,255,255,0.35)"} 
                        strokeWidth={isTraversed ? "3" : "2"}
                        strokeDasharray={isSeaRoute ? "5,5" : "0"}
                        className="transition-all duration-300"
                    />
                );
            }
        });
    });
    return lines;
  };

  const getUnitIcon = (type: UnitType) => {
    switch(type) {
        case UnitType.FLEET: return <Ship size={18} className="text-white drop-shadow-md" />;
        case UnitType.LEGION: return <Shield size={18} className="text-white drop-shadow-md" />;
        case UnitType.MERCENARY: return <Swords size={18} className="text-white drop-shadow-md" />;
        default: return <div className="w-2 h-2 bg-white rounded-full"></div>;
    }
  };

  const renderUnitsMoving = () => {
      const visibleUnits = gameState.playerFaction === Faction.SPECTATOR 
        ? gameState.units 
        : gameState.units.filter(u => u.owner === gameState.playerFaction || (u.isMoving && !gameState.nodes[u.locationId].owner)); // Simple fog of war approximation

      return visibleUnits.filter(u => u.isMoving && u.destinationId).map(u => {
          const start = gameState.nodes[u.locationId];
          const end = gameState.nodes[u.destinationId!];
          
          const curX = start.x + (end.x - start.x) * (u.progress / 100);
          const curY = start.y + (end.y - start.y) * (u.progress / 100);

          return (
              <div 
                key={u.id}
                className={`absolute w-10 h-10 rounded-full border-2 shadow-lg flex items-center justify-center z-20 transition-transform
                    ${u.owner === Faction.ROME ? 'bg-red-700 border-red-200' : 'bg-yellow-600 border-yellow-100'}
                `}
                style={{ left: `${curX}%`, top: `${curY}%`, transform: 'translate(-50%, -50%)' }}
              >
                  {getUnitIcon(u.type)}
              </div>
          );
      });
  };

  return (
    <div className="relative w-screen h-screen bg-stone-900 overflow-hidden font-sans select-none">
      
      {/* Start Screen Overlay */}
      {!hasStarted && (
        <div 
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-stone-950 text-stone-100 pointer-events-auto overflow-y-auto bg-cover bg-center"
            style={gameState.startScreenImage ? { backgroundImage: `linear-gradient(to bottom, rgba(28,25,23,0.8), rgba(28,25,23,0.9)), url(${gameState.startScreenImage})` } : {}}
        >
          <Crown size={64} className="text-yellow-500 mb-4 animate-pulse" />
          <h1 className="text-6xl font-cinzel text-yellow-500 mb-2 text-center drop-shadow-lg">Punic Wars</h1>
          <h2 className="text-xl font-lato text-stone-400 mb-8 tracking-widest uppercase">Hannibal's Path</h2>
          
          {/* Gen Buttons */}
          <div className="mb-10 flex gap-4">
            <button 
              onClick={generateMapBackground} 
              disabled={isGeneratingMap || !!gameState.mapImage}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800/80 hover:bg-stone-700 border border-stone-600 rounded text-sm disabled:opacity-50 backdrop-blur"
            >
              {isGeneratingMap ? <Loader className="animate-spin" size={16}/> : <ImageIcon size={16} />}
              {gameState.mapImage ? "Game Map Ready" : "Generate AI Game Map"}
            </button>
            <button 
              onClick={generateStartBackground} 
              disabled={isGeneratingStart || !!gameState.startScreenImage}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800/80 hover:bg-stone-700 border border-stone-600 rounded text-sm disabled:opacity-50 backdrop-blur"
            >
              {isGeneratingStart ? <Loader className="animate-spin" size={16}/> : <ImageIcon size={16} />}
              {gameState.startScreenImage ? "Mosaic Theme Ready" : "Generate Mosaic Theme"}
            </button>
          </div>

          <div className="flex gap-8 items-stretch flex-wrap justify-center p-4">
            {/* Rome Card */}
            <div 
              onClick={() => startGame(Faction.ROME)}
              className="group w-72 bg-stone-900/90 border-4 border-red-900 hover:border-red-600 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col items-center text-center backdrop-blur-sm"
            >
                <Shield size={32} className="text-red-500 mb-4" />
                <h3 className="text-2xl font-cinzel text-white mb-2">Rome</h3>
                <button className="mt-auto px-6 py-2 bg-red-800 text-white rounded font-bold uppercase w-full">Play</button>
            </div>

            {/* Carthage Card */}
            <div 
              onClick={() => startGame(Faction.CARTHAGE)}
              className="group w-72 bg-stone-900/90 border-4 border-yellow-700 hover:border-yellow-500 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col items-center text-center backdrop-blur-sm"
            >
                <Anchor size={32} className="text-yellow-500 mb-4" />
                <h3 className="text-2xl font-cinzel text-white mb-2">Carthage</h3>
                <button className="mt-auto px-6 py-2 bg-yellow-800 text-white rounded font-bold uppercase w-full">Play</button>
            </div>

             {/* Spectator Card */}
             <div 
              onClick={() => startGame(Faction.SPECTATOR)}
              className="group w-72 bg-stone-900/90 border-4 border-purple-900 hover:border-purple-600 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col items-center text-center backdrop-blur-sm"
            >
                <Eye size={32} className="text-purple-500 mb-4" />
                <h3 className="text-2xl font-cinzel text-white mb-2">Spectator</h3>
                <p className="text-stone-400 text-xs mb-4">Watch the AI empires battle for supremacy.</p>
                <button className="mt-auto px-6 py-2 bg-purple-800 text-white rounded font-bold uppercase w-full">Watch</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Map Area */}
      <div 
        className="absolute inset-0 map-container shadow-inner" 
        style={gameState.mapImage ? { backgroundImage: `url(${gameState.mapImage})` } : {}}
      >
        {/* Summer Khaki Overlay */}
        <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 bg-[#C2B280] mix-blend-multiply ${!gameState.isWinter ? 'opacity-40' : 'opacity-0'}`}></div>
        
        {/* Winter Overlay */}
        <div className={`absolute inset-0 z-10 winter-overlay ${gameState.isWinter ? 'opacity-60' : 'opacity-0'}`}></div>
        
        {/* SVG Layer for Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {renderConnections()}
            {/* Target Line */}
            {gameState.isTargetingMode && gameState.selectedNodeId && (
                 <circle cx={`${gameState.nodes[gameState.selectedNodeId].x}%`} cy={`${gameState.nodes[gameState.selectedNodeId].y}%`} r="50" fill="none" stroke="white" strokeWidth="2" className="animate-ping opacity-50" />
            )}
        </svg>

        {/* Nodes */}
        <div className="absolute inset-0 z-10">
            {(Object.values(gameState.nodes) as GameNode[]).map(node => (
                <MapNode 
                    key={node.id} 
                    node={node} 
                    isSelected={gameState.selectedNodeId === node.id}
                    onClick={handleNodeClick}
                    unitCount={gameState.units.filter(u => u.locationId === node.id && !u.isMoving && (gameState.playerFaction === Faction.SPECTATOR || u.owner === gameState.playerFaction)).length}
                    hasTraining={gameState.units.some(u => u.locationId === node.id && u.isTraining && (gameState.playerFaction === Faction.SPECTATOR || u.owner === gameState.playerFaction))}
                />
            ))}
        </div>

        {/* Moving Units */}
        {renderUnitsMoving()}
      </div>

      {/* UI Overlay */}
      <div className="relative z-30 h-full pointer-events-none">
          <GameUI 
            state={gameState} 
            onRecruit={handleRecruit}
            onEnterMoveMode={enterMoveMode}
            onFortify={handleFortify}
            onRally={handleRally}
            onHalt={handleHalt}
            onPauseToggle={() => setGameState(prev => ({...prev, gameSpeed: prev.gameSpeed === 0 ? 1 : 0}))}
            onRestart={() => window.location.reload()}
          />
      </div>

    </div>
  );
};

export default App;