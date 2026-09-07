import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';

import { VIEWS } from './rack.config';
import { RackScene } from './rack-scene';

@Component({
  selector: 'app-rack',
  templateUrl: './rack.html',
  styleUrl: './rack.scss',
})
export class Rack implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene?: RackScene;

  protected readonly views = VIEWS;
  protected readonly activeView = signal(VIEWS[0].id);

  ngAfterViewInit(): void {
    this.scene = new RackScene(this.canvasRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.scene?.dispose();
  }

  protected selectView(id: string): void {
    if (this.activeView() === id) return;
    this.activeView.set(id);
    this.scene?.setView(id);
  }
}
