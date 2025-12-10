import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapPhaseV1Component } from './map-phase-v1.component';

describe('MapPhaseV1Component', () => {
  let component: MapPhaseV1Component;
  let fixture: ComponentFixture<MapPhaseV1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapPhaseV1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapPhaseV1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
