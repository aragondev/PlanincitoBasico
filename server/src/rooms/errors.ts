import type { RoomErrorCode } from "@planincito/shared";

export class RoomOperationError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoomOperationError";
  }
}
