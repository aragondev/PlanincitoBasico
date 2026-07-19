import { useEffect, useState } from "react";

/**
 * Rutas por hash para no depender de reescrituras del servidor en
 * GitHub Pages (§17): `#/room/ABC123`.
 */
export function readRoomCodeFromHash(): string | null {
  const match = /^#\/room\/([A-Za-z0-9]+)$/.exec(window.location.hash);
  return match?.[1]?.toUpperCase() ?? null;
}

export function navigateToRoom(code: string): void {
  window.location.hash = `#/room/${code}`;
}

export function navigateHome(): void {
  if (window.location.hash === "") return;
  window.location.hash = "";
}

export function useRoomCodeFromHash(): string | null {
  const [code, setCode] = useState<string | null>(() => readRoomCodeFromHash());

  useEffect(() => {
    const onChange = () => setCode(readRoomCodeFromHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return code;
}

export function inviteLinkFor(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/room/${code}`;
}
