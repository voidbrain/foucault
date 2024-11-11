import {
  Component,
  Input,
  SimpleChanges,
  OnChanges,
  ViewChild,
} from '@angular/core';
import {
  Chart,
  ChartType,
  registerables,
  ChartConfiguration,
  ChartOptions,
} from 'chart.js/auto';

import { BaseChartDirective } from 'ng2-charts';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [BaseChartDirective, JsonPipe],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
})
export class ChartComponent implements OnChanges {
  @ViewChild(BaseChartDirective) chart!: BaseChartDirective;
  @Input() data: ChartConfiguration['data'] | undefined;
  @Input() options: ChartOptions | undefined;
  @Input() type: ChartType | undefined;

  chartTypes: Record<string, ChartType> = {
    line: 'line',
    bar: 'bar',
    doughnut: 'doughnut',
  };

  public chartType: ChartType = this.chartTypes['doughnut'];
  public chartData: ChartConfiguration['data'] | undefined;
  public chartOptions: ChartOptions = {
    responsive: true,
  };
  @Input() chartLegend = true;

  @Input() chartConfig?: ChartConfiguration;

  constructor() {
    Chart.register(...registerables);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chartConfig'] && changes['chartConfig'].currentValue) {
      this.updateChartConfig(changes['chartConfig'].currentValue);
    }
  }

  private updateChartConfig(config: ChartConfiguration) {
    if (config.type) {
      this.chartType = config.type;
    }
    if (config.data) {
      this.chartData = config.data;
    }
    if (config.options) {
      this.chartOptions = { ...this.chartOptions, ...config.options };
    }
  }
}
