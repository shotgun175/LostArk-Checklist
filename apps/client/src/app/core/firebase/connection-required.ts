/**
 * An action was refused because it needs the server: the device is offline, or changes made here
 * have not reached the server yet. The message is written for the user and is shown as it is.
 */
export class ConnectionRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionRequiredError";
  }
}

/** The message for an action refused while offline, for example "log out". */
export function offlineMessage(action: string): string {
  return `You're offline. Connect to the internet to ${action}.`;
}
