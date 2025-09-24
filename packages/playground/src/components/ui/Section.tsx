import "./Section.css";

interface SectionProps {
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Section({ children, style }: SectionProps) {
  return (
    <div className="control-section" style={style}>
      {children}
    </div>
  );
}
