import React from 'react';
import { GameNode, NodeType, Faction } from '../types';
import { Anchor, Castle, Waves, Hammer, ShieldCheck } from 'lucide-react';

interface MapNodeProps {
  node: GameNode;
  isSelected: boolean;
  onClick: (id: string) => void;
  unitCount: number;
  hasTraining: boolean;
}

const MapNode: React.FC<MapNodeProps> = ({ node, isSelected, onClick, unitCount, hasTraining }) => {
  const getFactionColor = (faction: Faction) => {
    switch (faction) {
      case Faction.ROME: return 'bg-red-600 border-red-800';
      case Faction.CARTHAGE: return 'bg-yellow-500 border-yellow-700';
      default: return 'bg-gray-400 border-gray-600'; // Neutral
    }
  };

  const getIcon = () => {
    if (node.type === NodeType.SEA) return <Waves size={16} className="text-blue-200" />;
    if (node.type === NodeType.PORT) return <Anchor size={16} className="text-white" />;
    return <Castle size={16} className="text-white" />;
  };

  // Sea nodes look different
  if (node.type === NodeType.SEA) {
    return (
      <div
        onClick={() => onClick(node.id)}
        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300
          ${isSelected ? 'scale-125 drop-shadow-lg border-white' : 'hover:scale-110 border-blue-300'}
          w-14 h-14 rounded-full flex items-center justify-center border-2
          bg-blue-500/40 backdrop-blur-sm
        `}
        style={{ left: `${node.x}%`, top: `${node.y}%` }}
      >
        {getIcon()}
        {unitCount > 0 && (
           <div className="absolute -top-2 -right-2 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border border-white">
             {unitCount}
           </div>
        )}
         <div className="absolute -bottom-6 text-[10px] font-bold text-blue-100 whitespace-nowrap pointer-events-none drop-shadow-md">
          {node.name}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick(node.id)}
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300
        ${isSelected ? 'scale-125 ring-4 ring-white z-20' : 'hover:scale-110 z-10'}
        w-12 h-12 rounded-md flex items-center justify-center border-4 shadow-lg
        ${getFactionColor(node.owner)}
      `}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      {getIcon()}
      
      {/* Unit Badge */}
      {unitCount > 0 && (
         <div className="absolute -top-3 -right-3 bg-black text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white z-10">
           {unitCount}
         </div>
      )}

      {/* Training Badge */}
      {hasTraining && (
         <div className="absolute -top-3 -left-3 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white z-10 animate-pulse">
           <Hammer size={12} />
         </div>
      )}

      {/* Fortification Level */}
      {node.fortificationLevel > 0 && (
         <div className="absolute -bottom-3 -right-3 bg-stone-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white z-10">
            <ShieldCheck size={10} />
         </div>
      )}

      {/* Name Label */}
      <div className="absolute -bottom-6 text-xs font-bold text-stone-800 bg-white/80 px-1 rounded whitespace-nowrap pointer-events-none border border-stone-400">
        {node.name}
      </div>
    </div>
  );
};

export default MapNode;