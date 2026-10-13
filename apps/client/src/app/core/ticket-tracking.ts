import { Character } from '../model/character/character';
import { Settings } from '../model/settings';

/**
 * Whether the Checklist shows the Tickets tracking panel. The Settings switch decides once it has
 * been used; until then the panel shows only for rosters that already have a ticket count, so
 * nobody who tracks tickets loses the panel.
 */
export function isTicketTrackingOn(settings: Pick<Settings, 'trackTickets'>, characters: Pick<Character, 'tickets'>[]): boolean {
  if (typeof settings.trackTickets === 'boolean') {
    return settings.trackTickets;
  }
  return characters.some(character => Object.values(character.tickets ?? {}).some(count => count > 0));
}
