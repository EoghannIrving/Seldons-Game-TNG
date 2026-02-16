import { DemographicSnapshot } from '../core/types';

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  private getCssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }

  public render(data: DemographicSnapshot[], metric: keyof DemographicSnapshot, color: string, label: string) {
    const axisColor = this.getCssVar('--text-dim', '#88bbdd');
    const labelColor = this.getCssVar('--text-muted', '#888888');

    if (!data || data.length < 2) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = labelColor;
        this.ctx.font = '14px "Space Mono"';
        this.ctx.fillText("Not enough data yet...", this.width / 2 - 60, this.height / 2);
        return;
    }

    // Clear
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Grid
    this.drawGrid();

    // Find min/max
    const maxVal = Math.max(...data.map(d => Number(d[metric]))) * 1.1; // 10% headroom
    const minVal = 0; 

    const padding = 40;
    const graphWidth = this.width - padding * 2;
    const graphHeight = this.height - padding * 2;

    // Draw Line
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.lineJoin = 'round';

    data.forEach((d, i) => {
      const x = padding + (i / (data.length - 1)) * graphWidth;
      // Invert Y because canvas 0 is top
      const val = Number(d[metric]);
      const normalizedVal = (val - minVal) / (maxVal - minVal);
      const y = (this.height - padding) - (normalizedVal * graphHeight);

      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });

    this.ctx.stroke();
    
    // Draw Area under line (optional, for style)
    this.ctx.lineTo(padding + graphWidth, this.height - padding);
    this.ctx.lineTo(padding, this.height - padding);
    this.ctx.fillStyle = color + '22'; // 22 = low opacity hex
    this.ctx.fill();

    // Draw Axes
    this.ctx.strokeStyle = axisColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(padding, padding);
    this.ctx.lineTo(padding, this.height - padding);
    this.ctx.lineTo(this.width - padding, this.height - padding);
    this.ctx.stroke();

    // Draw Labels
    this.ctx.fillStyle = axisColor;
    this.ctx.font = '10px "Space Mono"';
    this.ctx.textAlign = 'right';
    
    // Y-Axis Labels
    this.ctx.fillText(Math.floor(maxVal).toString(), padding - 5, padding + 5);
    this.ctx.fillText(Math.floor(maxVal / 2).toString(), padding - 5, padding + graphHeight / 2);
    this.ctx.fillText('0', padding - 5, this.height - padding);
    
    // X-Axis Labels (Phase)
    this.ctx.textAlign = 'center';
    const startPhase = data[0]?.phase || 0;
    const endPhase = data[data.length - 1]?.phase || 0;
    
    this.ctx.fillText(`Phase ${startPhase}`, padding, this.height - padding + 15);
    this.ctx.fillText(`Phase ${endPhase}`, this.width - padding, this.height - padding + 15);
    
    // Title
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = color;
    this.ctx.font = '14px "Space Mono"';
    this.ctx.fillText(label, this.width / 2, padding / 2 + 5);
  }

  public drawPieChart(data: Array<{ name: string, count: number, color: string }>) {
    const axisColor = this.getCssVar('--text-dim', '#88bbdd');
    const labelColor = this.getCssVar('--text-muted', '#888888');
    const mainColor = this.getCssVar('--text-main', '#00ffff');
    const bgColor = this.getCssVar('--bg-color', '#000000');

    // Clear
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Title
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = mainColor;
    this.ctx.font = '16px "Space Mono"';
    this.ctx.fillText("Political Power Distribution", this.width / 2, 30);

    if (!data || data.length === 0) {
        this.ctx.fillStyle = labelColor;
        this.ctx.font = '14px "Space Mono"';
        this.ctx.fillText("No political data yet...", this.width / 2, this.height / 2);
        return;
    }

    const total = data.reduce((acc, item) => acc + item.count, 0);
    const centerX = this.width / 2 - 100; // Shift left to make room for legend
    const centerY = this.height / 2 + 10;
    const radius = Math.min(this.width, this.height) / 3;

    let startAngle = 0;

    // Draw Slices
    data.forEach(slice => {
        const sliceAngle = (slice.count / total) * 2 * Math.PI;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        this.ctx.closePath();
        
        this.ctx.fillStyle = slice.color;
        this.ctx.fill();
        this.ctx.strokeStyle = bgColor; // Separator
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        startAngle += sliceAngle;
    });

    // Draw Legend
    const legendX = centerX + radius + 40;
    let legendY = centerY - (data.length * 25) / 2;

    this.ctx.textAlign = 'left';
    this.ctx.font = '12px "Space Mono"';

    data.forEach(slice => {
        // Color box
        this.ctx.fillStyle = slice.color;
        this.ctx.fillRect(legendX, legendY, 15, 15);
        this.ctx.strokeStyle = axisColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(legendX, legendY, 15, 15);

        // Text
        this.ctx.fillStyle = axisColor;
        const percent = ((slice.count / total) * 100).toFixed(1);
        this.ctx.fillText(`${slice.name} (${percent}%)`, legendX + 25, legendY + 12);

        legendY += 25;
    });
  }

  private drawGrid() {
    const padding = 40;
    // const graphWidth = this.width - padding * 2;
    const graphHeight = this.height - padding * 2;

    this.ctx.strokeStyle = this.getCssVar('--text-dim', '#88bbdd');
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();

    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
        const y = padding + (i / 4) * graphHeight;
        this.ctx.moveTo(padding, y);
        this.ctx.lineTo(this.width - padding, y);
    }
    
    this.ctx.stroke();
  }
}
