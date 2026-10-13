import { isTicketTrackingOn } from './ticket-tracking';
import { Character } from '../model/character/character';

const withTickets = (tickets: Partial<Character['tickets']>): Pick<Character, 'tickets'> => ({ tickets: tickets as Character['tickets'] });

describe('isTicketTrackingOn', () => {
  it('follows the switch once it is set', () => {
    expect(isTicketTrackingOn({ trackTickets: true }, [])).toBe(true);
    expect(isTicketTrackingOn({ trackTickets: false }, [withTickets({ EbonyCubeLevel1: 3 })])).toBe(false);
  });

  it('is off by default when no character has a ticket count', () => {
    expect(isTicketTrackingOn({}, [withTickets({ EbonyCubeLevel1: 0 }), withTickets({})])).toBe(false);
  });

  it('is on by default when a character already has a ticket count', () => {
    expect(isTicketTrackingOn({}, [withTickets({}), withTickets({ EbonyCube2ndUnlock: 1 })])).toBe(true);
  });

  it('copes with characters saved without tickets', () => {
    expect(isTicketTrackingOn({}, [{ tickets: undefined }])).toBe(false);
  });
});
