import React from 'react';
import { Faction, GameNode, GameState, NodeType, UnitType } from '../types';
import { Coins, Snowflake, Sun, Shield, Anchor, Play, Pause, Users, Footprints, Swords, BrickWall, Flag, Hand, Eye } from 'lucide-react';
import { UNIT_COST, FORTIFY_COST, MAX_FORTIFICATION } from '../constants';

interface GameUIProps {
  state: GameState;
  onRecruit: (type: UnitType) => void;
  onEnterMoveMode: () => void;
  onFortify: () => void;
  onRally: () => void;
  onHalt: () => void;
  onPauseToggle: () => void;
  onRestart: () => void;
}

const GameUI: React.FC<GameUIProps> = ({ state, onRecruit, onEnterMoveMode, onFortify, onRally, onHalt, onPauseToggle, onRestart }) => {
  const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
  const isPlayerNode = selectedNode?.owner === state.playerFaction;
  const isSpectator = state.playerFaction === Faction.SPECTATOR;
  
  const playerGold = state.resources.gold[state.playerFaction] || 0;
  // Local manpower if node selected, else total for flavor
  const localManpower = selectedNode ? selectedNode.localManpower : 0;
  
  // Enemy Intel Calculation
  const enemyFaction = state.playerFaction === Faction.ROME ? Faction.CARTHAGE : Faction.ROME;
  const enemyStrength = state.units
    .filter(u => u.owner === enemyFaction)
    .reduce((acc, u) => acc + u.strength, 0);

  const nodeUnits = selectedNode ? state.units.filter(u => u.locationId === selectedNode.id && u.owner === state.playerFaction && !u.isMoving && !u.isTraining) : [];
  const canMove = nodeUnits.length > 0;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      
      {/* Top Bar: Stats */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-stone-900/90 text-stone-100 p-4 rounded-lg border-2 border-yellow-600 shadow-xl flex gap-6">
          
          {/* Faction Info */}
          <div className="flex items-center gap-3">
             {isSpectator ? (
                 <div className="w-4 h-12 bg-purple-600 rounded-sm border border-white animate-pulse"></div>
             ) : (
                 <div className={`w-4 h-12 ${state.playerFaction === Faction.ROME ? 'bg-red-600' : 'bg-yellow-500'} rounded-sm border border-white`}></div>
             )}
             <div>
               <div className="text-sm text-stone-400 uppercase tracking-widest">Faction</div>
               <div className="font-cinzel font-bold text-xl">{state.playerFaction === Faction.SPECTATOR ? 'OBSERVER' : state.playerFaction}</div>
             </div>
          </div>

          {/* Resources (Hidden for Spectator) */}
          {!isSpectator && (
            <div className="flex gap-6 px-4 border-l border-stone-700">
                <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-yellow-400 font-bold text-xl">
                    <Coins size={20} />
                    {Math.floor(playerGold)}
                    </div>
                    <div className="text-xs text-stone-400">Gold</div>
                </div>
                
                {/* Enemy Intel Display */}
                <div className="flex flex-col justify-center border-l border-stone-700 pl-4">
                    <div className="flex items-center gap-2 text-red-500 font-bold text-lg">
                        <Swords size={20} />
                        ~{Math.floor(enemyStrength / 10) * 10}
                    </div>
                    <div className="text-xs text-stone-400">Est. Enemy Strength</div>
                </div>
            </div>
          )}
          
          {/* Spectator Stats */}
          {isSpectator && (
               <div className="flex gap-6 px-4 border-l border-stone-700">
                   <div className="flex flex-col justify-center">
                       <div className="text-red-400 font-bold">ROME: {Math.floor(state.resources.gold[Faction.ROME])}g</div>
                   </div>
                   <div className="flex flex-col justify-center border-l border-stone-700 pl-4">
                       <div className="text-yellow-400 font-bold">CARTH: {Math.floor(state.resources.gold[Faction.CARTHAGE])}g</div>
                   </div>
               </div>
          )}

           {/* Date/Season */}
           <div className="flex flex-col justify-center border-l border-stone-700 pl-4">
            <div className={`flex items-center gap-2 font-bold text-xl ${state.isWinter ? 'text-blue-300' : 'text-orange-300'}`}>
              {state.isWinter ? <Snowflake size={20} className="animate-pulse" /> : <Sun size={20} />}
              {state.isWinter ? 'WINTER' : 'SUMMER'}
            </div>
            <div className="text-xs text-stone-400">Day {state.day}</div>
          </div>
          
           {/* Controls */}
           <div className="flex items-center gap-2 border-l border-stone-700 pl-4">
             <button 
                onClick={onPauseToggle} 
                className="p-2 hover:bg-stone-700 rounded-full transition-colors"
             >
               {state.gameSpeed === 0 ? <Play size={24} /> : <Pause size={24} />}
             </button>
           </div>
        </div>

        {/* Event Log (Recent) */}
        <div className="bg-stone-900/80 text-stone-200 p-2 rounded max-w-md max-h-32 overflow-y-auto text-xs space-y-1 border border-stone-700">
            {state.log.slice(-5).reverse().map((msg, i) => (
                <div key={i} className="border-b border-stone-700 pb-1 last:border-0">{msg}</div>
            ))}
        </div>
      </div>

      {/* Center: Game Over Screen */}
      {state.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 pointer-events-auto">
          <div className="bg-stone-800 p-8 rounded-lg border-4 border-yellow-600 text-center max-w-lg">
            <h2 className="text-4xl font-cinzel text-yellow-500 mb-4">
              {state.winner === state.playerFaction ? 'VICTORY!' : (isSpectator ? `${state.winner} WINS!` : 'DEFEAT!')}
            </h2>
            <p className="text-stone-300 mb-6 text-lg font-lato">
              {state.winner === state.playerFaction 
                ? "The Mediterranean is yours. Your enemies have been crushed beneath your heel." 
                : (isSpectator ? `The Punic Wars end. ${state.winner} reigns supreme.` : "Your civilization has fallen into ruin. History will forget your name.")}
            </p>
            <button 
              onClick={onRestart}
              className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded font-cinzel border-2 border-red-900 transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Bottom Bar: Actions (Only if node selected) */}
      <div className="flex justify-center pointer-events-auto min-h-[140px]">
        {selectedNode && isPlayerNode && !state.isWinter && !isSpectator && (
          <div className="bg-stone-900/95 text-stone-100 p-4 rounded-t-xl border-x-2 border-t-2 border-yellow-600 shadow-2xl flex gap-6 animate-slide-up items-center">
            <div className="flex flex-col justify-center border-r border-stone-700 pr-4 min-w-[140px]">
              <div className="font-bold text-lg font-cinzel">{selectedNode.name}</div>
              <div className="text-xs text-stone-400">{selectedNode.type}</div>
              <div className="text-xs text-yellow-500 mt-1">Income: +{selectedNode.income}g/yr</div>
              <div className="text-xs text-blue-400">Manpower: {Math.floor(selectedNode.localManpower)}/{selectedNode.maxManpower}</div>
              <div className="text-xs text-stone-300 mt-2">{nodeUnits.length} Ready Units</div>
               {selectedNode.fortificationLevel > 0 && (
                   <div className="text-xs text-orange-400 mt-1">Walls: Lv {selectedNode.fortificationLevel}</div>
               )}
            </div>

            {/* Actions Container */}
            <div className="flex gap-4">
                
                {/* Move Button */}
                <button 
                    onClick={onEnterMoveMode}
                    disabled={!canMove || state.isTargetingMode}
                    className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all
                      ${canMove && !state.isTargetingMode
                        ? 'bg-stone-800 border-stone-500 hover:bg-stone-700 hover:border-white hover:scale-105' 
                        : 'bg-stone-900 border-stone-800 opacity-50 cursor-not-allowed'}
                      ${state.isTargetingMode ? 'ring-2 ring-white animate-pulse' : ''}
                    `}
                >
                     <Footprints size={18} className="mb-1 text-green-400" />
                     <span className="font-bold text-[10px]">Move</span>
                </button>

                {/* Rally Button */}
                <button 
                    onClick={onRally}
                    className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all bg-stone-800 border-stone-500 hover:bg-stone-700 hover:border-white`}
                >
                     <Flag size={18} className="mb-1 text-purple-400" />
                     <span className="font-bold text-[10px]">Rally Here</span>
                     <span className="text-[8px] text-stone-400 leading-none mt-1">Call Reserves</span>
                </button>

                 {/* Halt/Cancel Rally Button */}
                 <button 
                    onClick={onHalt}
                    className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all bg-stone-800 border-stone-500 hover:bg-red-900/50 hover:border-red-500`}
                >
                     <Hand size={18} className="mb-1 text-red-400" />
                     <span className="font-bold text-[10px]">Halt</span>
                     <span className="text-[8px] text-stone-400 leading-none mt-1">Cancel Incoming</span>
                </button>

                {/* Fortify Button */}
                 {(selectedNode.type === NodeType.CITY || selectedNode.type === NodeType.PORT) && (
                    <button 
                        onClick={onFortify}
                        disabled={playerGold < FORTIFY_COST || selectedNode.fortificationLevel >= MAX_FORTIFICATION}
                        className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all
                        ${playerGold >= FORTIFY_COST && selectedNode.fortificationLevel < MAX_FORTIFICATION
                            ? 'bg-stone-800 border-stone-500 hover:bg-stone-700 hover:border-orange-500' 
                            : 'bg-stone-900 border-stone-800 opacity-50 cursor-not-allowed'}
                        `}
                    >
                        <BrickWall size={18} className="mb-1 text-orange-400" />
                        <span className="font-bold text-[10px]">Fortify</span>
                        <span className="text-[9px] text-yellow-400">{FORTIFY_COST}g</span>
                    </button>
                 )}

                <div className="w-px bg-stone-700 mx-1"></div>

                {/* Army Recruitment */}
                {(selectedNode.type === NodeType.CITY || selectedNode.type === NodeType.PORT) && (
                   <button 
                    onClick={() => onRecruit(state.playerFaction === Faction.ROME ? UnitType.LEGION : UnitType.MERCENARY)}
                    disabled={playerGold < UNIT_COST.ARMY.gold || localManpower < UNIT_COST.ARMY.manpower}
                    className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all
                      ${playerGold >= UNIT_COST.ARMY.gold && localManpower >= UNIT_COST.ARMY.manpower
                        ? 'bg-stone-800 border-stone-500 hover:bg-stone-700 hover:border-yellow-500' 
                        : 'bg-stone-900 border-stone-800 opacity-50 cursor-not-allowed'}
                    `}
                   >
                     {state.playerFaction === Faction.ROME ? <Shield size={18} className="mb-1 text-red-400"/> : <Swords size={18} className="mb-1 text-yellow-400"/>}
                     <span className="font-bold text-[10px]">{state.playerFaction === Faction.ROME ? 'Legion' : 'Merc'}</span>
                     <div className="flex gap-1 text-[9px] mt-0.5">
                        <span className="text-yellow-400">{UNIT_COST.ARMY.gold}g</span>
                     </div>
                   </button>
                )}

                {/* Fleet Recruitment */}
                {selectedNode.type === NodeType.PORT && (
                    <button 
                    onClick={() => onRecruit(UnitType.FLEET)}
                    disabled={playerGold < UNIT_COST.FLEET.gold || localManpower < UNIT_COST.FLEET.manpower}
                    className={`flex flex-col items-center justify-center w-20 h-20 rounded border-2 transition-all
                      ${playerGold >= UNIT_COST.FLEET.gold && localManpower >= UNIT_COST.FLEET.manpower
                        ? 'bg-stone-800 border-stone-500 hover:bg-stone-700 hover:border-blue-400' 
                        : 'bg-stone-900 border-stone-800 opacity-50 cursor-not-allowed'}
                    `}
                   >
                     <Anchor size={18} className="mb-1 text-blue-300" />
                     <span className="font-bold text-[10px]">Fleet</span>
                     <div className="flex gap-1 text-[9px] mt-0.5">
                        <span className="text-yellow-400">{UNIT_COST.FLEET.gold}g</span>
                     </div>
                   </button>
                )}
            </div>
          </div>
        )}
        {selectedNode && (!isPlayerNode || isSpectator) && (
           <div className="bg-stone-900/95 text-stone-100 p-4 rounded-t-xl border-x-2 border-t-2 border-stone-600 flex gap-6">
              <div className="flex flex-col justify-center">
                <div className="font-bold text-lg font-cinzel text-stone-300">{selectedNode.name}</div>
                <div className="text-xs text-stone-500">Controlled by {selectedNode.owner}</div>
                {!isSpectator && <div className="text-xs text-red-400 font-bold mt-1">Enemy Territory</div>}
                {selectedNode.fortificationLevel > 0 && <div className="text-xs text-orange-400">Fortified (Lv {selectedNode.fortificationLevel})</div>}
              </div>
           </div>
        )}
        {state.isWinter && (
          <div className="bg-blue-900/95 text-white p-4 rounded-t-xl backdrop-blur flex items-center gap-3 border-t-2 border-blue-400">
            <Snowflake className="animate-spin-slow" />
            <div>
              <div className="font-bold">Winter Quarters</div>
              <div className="text-xs opacity-80">Armies are returning home. Offensive operations impossible.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameUI;