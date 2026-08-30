type Props = { className?: string };

/**
 * Iconos de la interfaz en SVG de trazo uniforme. Antes eran emoji: cada
 * sistema los dibuja con su propio color y grosor, así que la fila de
 * controles nunca se veía como un conjunto. Heredan `currentColor`, de modo
 * que siguen al tema y a los estados de los botones.
 */
function Svg({
  className,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function UsersIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M15.5 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
      <circle cx="9.25" cy="8" r="3.2" />
      <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M15.8 5.2a3.4 3.4 0 0 1 0 5.6" />
    </Svg>
  );
}

export function HistoryIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3.2 9.3A9 9 0 1 1 3 12" />
      <path d="M3 4.5V9.5h5" />
      <path d="M12 7.8V12l3.2 1.9" />
    </Svg>
  );
}

export function ChartIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </Svg>
  );
}

export function LinkIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
    </Svg>
  );
}

export function CheckIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M20 6.5 9.5 17 4 11.5" />
    </Svg>
  );
}

export function SunIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function MoonIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a6.8 6.8 0 0 0 10.9 10.9Z" />
    </Svg>
  );
}

export function ExitIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M15 12H5" />
    </Svg>
  );
}

export function CloseIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function EyeIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}

/** Carita para abrir el listado de emoticones de un asiento. */
export function ReactionIcon(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0" />
      <path d="M9.2 9.6h.01M14.8 9.6h.01" />
    </Svg>
  );
}
