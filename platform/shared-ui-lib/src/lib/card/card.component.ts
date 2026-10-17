import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
})
export class CardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() features: string[] = [];
  @Input() openUrl = '#';
  @Output() open = new EventEmitter<void>();
}
