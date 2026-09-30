import { json } from '../http';

export function handleHealth(): Response {
  // Deliberately does not reveal which AI provider is configured.
  return json({ ok: true, service: 'leo-racer', time: new Date().toISOString() });
}
