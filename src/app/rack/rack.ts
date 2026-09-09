import {
  afterRenderEffect,
  Component,
  ElementRef,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { VIEWS } from './rack.config';
import { RackScene } from './rack-scene';

@Component({
  selector: 'app-rack',
  templateUrl: './rack.html',
  styleUrl: './rack.scss',
})
export class Rack {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private scene?: RackScene;

  protected readonly views = VIEWS;
  protected readonly activeView = signal(VIEWS[0].id);

  constructor() {
    // La recarga de plantillas puede reemplazar el canvas sin recrear el componente.
    afterRenderEffect((onCleanup) => {
      const scene = new RackScene(this.canvasRef().nativeElement);
      this.scene = scene;
      const view = untracked(this.activeView);
      if (view !== VIEWS[0].id) scene.setView(view);
      onCleanup(() => {
        scene.dispose();
        if (this.scene === scene) this.scene = undefined;
      });
    });
  }

  protected selectView(id: string): void {
    if (this.activeView() === id) return;
    this.activeView.set(id);
    this.scene?.setView(id);
  }
}
