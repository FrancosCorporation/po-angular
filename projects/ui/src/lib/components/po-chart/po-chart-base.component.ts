import { EventEmitter, Input, Output, Directive, OnChanges, SimpleChanges } from '@angular/core';

import { convertToInt, isTypeof } from '../../utils/util';

import { PoChartGaugeSerie } from './po-chart-types/po-chart-gauge/po-chart-gauge-series.interface';
import { PoChartType } from './enums/po-chart-type.enum';
import { PoChartOptions } from './interfaces/po-chart-options.interface';
import { PoChartSerie } from './interfaces/po-chart-serie.interface';

const poChartDefaultHeight = 400;
const poChartMinHeight = 200;

/**
 * @description
 *
 * O `po-chart` é um componente para renderização de dados através de gráficos, com isso facilitando a compreensão e tornando a
 * visualização destes dados mais agradável.
 *
 * Através de suas principais propriedades é possível definir atributos, tais como tipo de gráfico, altura, título, opções para os eixos, entre outros.
 *
 * O componente permite utilizar em conjunto séries do tipo linha e coluna.
 *
 * Além disso, também é possível definir uma ação que será executada ao clicar em determinado elemento do gráfico
 * e outra que será executada ao passar o *mouse* sobre o elemento.
 *
 * #### Boas práticas
 *
 * - Para que o gráfico não fique ilegível e incompreensível, evite uma quantia excessiva de séries.
 */
@Directive()
export abstract class PoChartBaseComponent implements OnChanges {
  private _options: PoChartOptions;
  private _categories: Array<string>;
  private _height: number;
  private _series: Array<PoChartSerie> | PoChartGaugeSerie;
  private _type: PoChartType;

  // manipulação das séries tratadas internamente para preservar 'p-series';
  chartSeries: Array<PoChartSerie | PoChartGaugeSerie> = [];
  chartType: PoChartType;

  private defaultType: PoChartType;

  /**
   * @optional
   *
   * @description
   *
   * Define a altura do gráfico.
   *
   * > O valor mínimo aceito nesta propriedade é 200.
   *
   * @default `400px`
   */
  @Input('p-height') set height(value: number) {
    const intValue = convertToInt(value);
    let height: number;

    if (isTypeof(value, 'number')) {
      height = intValue <= poChartMinHeight ? poChartMinHeight : intValue;
    } else {
      height = this.setDefaultHeight();
    }

    this._height = height;

    this.getSvgContainerSize();
    this.rebuildComponentRef();
  }

  get height(): number {
    return this._height || this.setDefaultHeight();
  }

  /**
   * @optional
   *
   * @description
   *
   * Define o tipo de gráfico.
   *
   * É possível também combinar gráficos dos tipos linha e coluna. Para isso, opte pela declaração de `type` conforme a interface `PoChartSerie`.
   *
   * > Note que, se houver declaração de tipo de gráfico tanto em `p-type` quanto em `PochartSerie.type`, o valor `{ type }` da primeira série anulará o valor definido em `p-type`.
   *
   * Se não passado valor, o padrão será relativo à primeira série passada em `p-series`:
   * - Se `p-series = [{ data: [1,2,3] }]`: será `PoChartType.Column`.
   * - Se `p-series = [{ data: 1 }]`: será `PoChartType.Pie`.
   *
   * > Veja os valores válidos no *enum* `PoChartType`.
   */
  @Input('p-type') set type(value: PoChartType) {
    // O Valor default definido em `p-series` de acordo com a primeira série passada.
    this._type = (<any>Object).values(PoChartType).includes(value) ? value : undefined;

    this.rebuildComponentRef();
  }

  get type(): PoChartType {
    return this._type;
  }

  /**
   * @description
   *
   * Define os elementos do gráfico que serão criados dinamicamente.
   */
  @Input('p-series') set series(value: Array<PoChartSerie> | PoChartGaugeSerie) {
    this._series = value || [];
    if (Array.isArray(this._series) && this._series.length) {
      this.setTypeDefault(this._series[0]);
    } else {
      this.transformObjectToArrayObject(this.series as PoChartGaugeSerie);
      this.rebuildComponentRef();
    }
  }

  get series() {
    return this._series;
  }

  /**
   * @optional
   *
   * @description
   *
   * Define os nomes das categorias que serão plotadas nos eixos Y do grid do gráfico.
   *
   * > Caso não seja especificado um valor para a categoria, será plotado um hífen na categoria referente a cada valor de série.
   */
  @Input('p-categories') set categories(value: Array<string>) {
    if (Array.isArray(value)) {
      this._categories = value;
    }
  }

  get categories() {
    return this._categories;
  }

  /** Define o título do gráfico. */
  @Input('p-title') title?: string;

  /**
   * @optional
   *
   * @description
   *
   * Objeto com as configurações usadas no `po-chart`.
   *
   * É possível definir as configurações dos eixos(*axis*) para os gráfico do tipo `Line`, `Column` e `Bar` da seguinte forma:
   *
   * ```
   *  chartOptions: PoChartOptions = {
   *    axis: {
   *      minRange: 0,
   *      maxRange: 100,
   *      gridLines: 5,
   *    },
   *  };
   * ```
   * > Para gráficos dos tipos `Column` e `Bar`, não será aceito valor negativo para a cofiguração `axis.minRange`.
   */
  @Input('p-options') set options(value: PoChartOptions) {
    if (value instanceof Object && !(value instanceof Array)) {
      this._options = value;
    }
  }

  get options() {
    return this._options;
  }

  /**
   * @optional
   *
   * @description
   *
   * Evento executado quando o usuário clicar sobre um elemento do gráfico.
   *
   * O evento emitirá o seguinte parâmetro:
   * - *donut* e *pie*: um objeto contendo a categoria e valor da série.
   * - *line*, *column* e *bar*: um objeto contendo o nome da série, valor e categoria do eixo do gráfico.
   */
  @Output('p-series-click')
  seriesClick = new EventEmitter<PoChartSerie | PoChartGaugeSerie>();

  /**
   * @optional
   *
   * @description
   *
   * Evento executado quando o usuário passar o *mouse* sobre um elemento do gráfico.
   *
   * O evento emitirá o seguinte parâmetro de acordo com o tipo de gráfico:
   * - *donut* e *pie*: um objeto contendo a categoria e valor da série.
   * - *line*, *column* e *bar*: um objeto contendo a categoria, valor da série e categoria do eixo do gráfico.
   */
  @Output('p-series-hover')
  seriesHover = new EventEmitter<PoChartSerie | PoChartGaugeSerie>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes.series && Array.isArray(this.series) && this.series.length) ||
      (changes.type && Array.isArray(this.series) && this.series.length)
    ) {
      this.validateSerieAndAddType(this.series);
    }
  }

  onSeriesClick(event: any): void {
    this.seriesClick.emit(event);
  }

  onSeriesHover(event: any): void {
    this.seriesHover.emit(event);
  }

  private setDefaultHeight() {
    return this.type === PoChartType.Gauge ? poChartMinHeight : poChartDefaultHeight;
  }

  private transformObjectToArrayObject(serie: PoChartGaugeSerie) {
    this.chartSeries = typeof serie === 'object' && Object.keys(serie).length ? [{ ...serie }] : [];
  }

  private setTypeDefault(serie: PoChartSerie) {
    const data = serie.data ?? serie.value;
    const serieType = (<any>Object).values(PoChartType).includes(serie.type) ? serie.type : undefined;

    this.defaultType = serieType ? serieType : Array.isArray(data) ? PoChartType.Column : PoChartType.Pie;
  }

  private validateSerieAndAddType(series: Array<PoChartSerie>): void {
    const isTypeCircular = this.defaultType === PoChartType.Pie || this.defaultType === PoChartType.Donut;

    this.chartSeries = series
      .filter(serie =>
        isTypeCircular ? typeof serie.data === 'number' || typeof serie.value === 'number' : Array.isArray(serie.data)
      )
      .map((serie, index) => {
        if (index === 0) {
          this.chartType = (<any>Object).values(PoChartType).includes(serie.type)
            ? serie.type
            : this.type || this.defaultType;
        }

        return { ...serie, type: serie.type || this.chartType };
      });
  }

  // válido para gráficos do tipo circular e que será refatorado.
  protected abstract getSvgContainerSize(): void;
  abstract rebuildComponentRef(): void;
}
