import "./Section.css";

interface SectionProps {
  title: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Section({ title, children, style }: SectionProps) {
  return (
    <div className="control-section" style={style}>
      <h4>{title}</h4>
      {children}
    </div>
  );
}
