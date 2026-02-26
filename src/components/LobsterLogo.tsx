interface LobsterLogoProps {
  className?: string;
}

export function LobsterLogo({ className = 'w-12 h-12' }: LobsterLogoProps) {
  return (
    <svg
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 12px rgba(255, 107, 0, 0.4))' }}
    >
      {/* Superhero Cape - flowing behind */}
      <path
        d="M60 45 
           C45 50 30 70 25 100 
           C20 115 22 130 30 135
           L60 110
           L90 135
           C98 130 100 115 95 100
           C90 70 75 50 60 45Z"
        fill="url(#cape-gradient)"
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
      />
      {/* Cape inner fold */}
      <path
        d="M60 50 
           C50 55 40 72 37 95
           L60 80
           L83 95
           C80 72 70 55 60 50Z"
        fill="url(#cape-inner-gradient)"
        opacity="0.7"
      />
      
      {/* Lobster Body */}
      <g transform="translate(10, 5)">
        <path
          d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z"
          fill="url(#lobster-orange-gradient)"
        />
        {/* Left Claw */}
        <path
          d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z"
          fill="url(#lobster-orange-gradient)"
        />
        {/* Right Claw */}
        <path
          d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z"
          fill="url(#lobster-orange-gradient)"
        />
        {/* Antenna */}
        <path d="M45 15 Q35 5 30 8" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
        <path d="M75 15 Q85 5 90 8" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" />
        {/* Eye Sockets */}
        <circle cx="45" cy="35" r="6" fill="#0a0a0a" />
        <circle cx="75" cy="35" r="6" fill="#0a0a0a" />
        {/* Pupils - bright orange glow */}
        <circle cx="46" cy="34" r="2" fill="#FF6B00" style={{ filter: 'drop-shadow(0 0 4px #FF6B00)' }} />
        <circle cx="76" cy="34" r="2" fill="#FF6B00" style={{ filter: 'drop-shadow(0 0 4px #FF6B00)' }} />
      </g>
      
      <defs>
        <linearGradient id="lobster-orange-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#CC5500" />
        </linearGradient>
        <linearGradient id="cape-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FF6B00" />
          <stop offset="50%" stopColor="#CC3300" />
          <stop offset="100%" stopColor="#991100" />
        </linearGradient>
        <linearGradient id="cape-inner-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFaa00" />
          <stop offset="100%" stopColor="#FF6B00" />
        </linearGradient>
      </defs>
    </svg>
  );
}
