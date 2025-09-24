import "./Field.css";

interface FieldProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Field({ className, children, style }: FieldProps) {
  return (
    <div className={`field ${className}`} style={style}>
      {children}
    </div>
  );
}
