import { AppService } from './app.service';

describe('AppService', () => {
  it('getHealth reports status ok with a timestamp', () => {
    const result = new AppService().getHealth();
    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
