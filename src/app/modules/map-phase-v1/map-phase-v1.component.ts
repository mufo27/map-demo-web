import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-map-phase-v1',
  standalone: true,
  templateUrl: './map-phase-v1.component.html',
  styleUrl: './map-phase-v1.component.scss',
})
export class MapPhaseV1Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;

  ngAfterViewInit(): void {
    (window as any).CESIUM_BASE_URL = '/assets/cesium/';

    this.initCesium();
  }

  initCesium() {
    this.viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: true,
      fullscreenButton: true,
    });

    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

    this.viewer.imageryLayers.removeAll();
    this.viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/',
      })
    );

    this.addGeoServerWMS();

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  addGeoServerWMS() {
    const geoserverUrl = 'http://192.168.88.217:6080/geoserver/wms';
    const workspace = 'test-thailand';

    // เพิ่ม Google Maps Satellite Layer (Phase 1 requirement)
    // try {
    //   this.viewer.imageryLayers.addImageryProvider(
    //     new Cesium.UrlTemplateImageryProvider({
    //       url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    //       credit: 'Google Maps Satellite',
    //     })
    //   );
    //   console.log('✓ Google Maps layer loaded');
    // } catch (error) {
    //   console.error('✗ Error loading Google Maps layer:', error);
    // }

    // Layer 1: ขอบเขตจังหวัด
    // try {
    //   this.viewer.imageryLayers.addImageryProvider(
    //     new Cesium.WebMapServiceImageryProvider({
    //       url: geoserverUrl,
    //       layers: `${workspace}:regionth-province-v3`,
    //       parameters: {
    //         transparent: true,
    //         format: 'image/png',
    //         styles: '',
    //       },
    //     })
    //   );
    //   console.log('✓ Province boundaries layer loaded');
    // } catch (error) {
    //   console.error('✗ Error loading province boundaries:', error);
    // }

    // Layer 2: ขอบเขตอำเภอ
    // try {
    //   this.viewer.imageryLayers.addImageryProvider(
    //     new Cesium.WebMapServiceImageryProvider({
    //       url: geoserverUrl,
    //       layers: `${workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
    //       parameters: {
    //         transparent: true,
    //         format: 'image/png',
    //         styles: '',
    //       },
    //     })
    //   );
    //   console.log('✓ District/Subdistrict boundaries layer loaded');
    // } catch (error) {
    //   console.error('✗ Error loading district boundaries:', error);
    // }

    // Layer 3: ถนน
    // try {
    //   this.viewer.imageryLayers.addImageryProvider(
    //     new Cesium.WebMapServiceImageryProvider({
    //       url: geoserverUrl,
    //       layers: `${workspace}:gis_osm_roads_free_1`,
    //       parameters: {
    //         transparent: true,
    //         format: 'image/png',
    //         styles: '',
    //       },
    //     })
    //   );
    //   console.log('✓ Roads layer loaded');
    // } catch (error) {
    //   console.error('✗ Error loading roads:', error);
    // }

    // Layer 4: คลอง/ทางน้ำ (Waterways)
    try {
      this.viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: geoserverUrl,
          layers: `${workspace}:gis_osm_waterways_free_1`,
          parameters: {
            transparent: true,
            format: 'image/png',
            styles: '',
          },
        })
      );
      console.log('✓ Waterways layer loaded');
    } catch (error) {
      console.error('✗ Error loading waterways:', error);
    }
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
  }
}
