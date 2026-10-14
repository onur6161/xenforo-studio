import React from "react";
import { Shield, Crown, Hexagon, Diamond } from "lucide-react";

export interface CorporateAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  emblem?: "shield" | "crown" | "hexagon" | "diamond" | string;
  username?: string;
  className?: string;
}

export const CorporateAvatar: React.FC<CorporateAvatarProps> = ({
  size = "md",
  color = "#d4af37",
  emblem = "shield",
  username = "TY",
  className = "",
}) => {
  const sizeMap = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
    xl: "w-16 h-16 text-base",
  };

  const iconSizeMap = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
    xl: "w-7 h-7",
  };

  const getEmblemIcon = () => {
    switch (emblem) {
      case "crown":
        return <Crown className={iconSizeMap[size]} />;
      case "hexagon":
        return <Hexagon className={iconSizeMap[size]} />;
      case "diamond":
        return <Diamond className={iconSizeMap[size]} />;
      case "shield":
      default:
        return <Shield className={iconSizeMap[size]} />;
    }
  };

  return (
    <div
      className={`relative rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform hover:scale-105 ${sizeMap[size]} ${className}`}
      style={{
        backgroundColor: "#181d28",
        borderColor: color,
        borderWidth: "1.5px",
        color: color,
        boxShadow: `0 0 14px ${color}33`,
      }}
      title={`Kurumsal Rozet: ${username}`}
    >
      {/* İkon / Rozet */}
      <div className="relative z-10 flex items-center justify-center">
        {getEmblemIcon()}
      </div>

      {/* Arka plan ışıltısı */}
      <div
        className="absolute inset-0 rounded-xl opacity-15"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
};
