import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Get()
  override async index(@Res() res: any): Promise<string> {
    const req = res.req;
    const authHeader = req?.headers['authorization'];
    const expectedToken = process.env.METRICS_BEARER_TOKEN || 'grafana-metrics-token';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="metrics"');
      res.status(401).send('Unauthorized: Missing or invalid Authorization header');
      return '';
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="metrics"');
      res.status(401).send('Unauthorized: Invalid credentials');
      return '';
    }

    const metrics = await super.index(res);
    res.status(200).send(metrics);
    return metrics;
  }
}
