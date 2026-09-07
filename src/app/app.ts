import { Component } from '@angular/core';

import { Rack } from './rack/rack';

@Component({
  selector: 'app-root',
  imports: [Rack],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
