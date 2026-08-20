import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('getHealth delegates to AppService.getHealth', () => {
    const controller = new AppController(new AppService());
    expect(controller.getHealth().status).toBe('ok');
  });
});
