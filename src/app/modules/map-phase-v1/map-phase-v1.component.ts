import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-map-phase-v1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-phase-v1.component.html',
  styleUrl: './map-phase-v1.component.scss',
})
export class MapPhaseV1Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'test-thailand';

  // Layer references for toggling
  private layers = {
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
  };

  // Layer visibility states (bound to checkboxes)
  layerControls = {
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    roads: false,
    waterways: false,
  };

  // Panel collapse state
  panelCollapsed = false;

  // Toggle panel method
  togglePanel() {
    this.panelCollapsed = !this.panelCollapsed;
  }

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

    // เรียก methods ตาม Tier architecture
    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();

    // Zoom to Thailand
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  // ============================================
  // TIER 0: Globe (Ellipsoid) - Base Layer
  // ============================================
  setupTier0_Globe() {
    // Cesium ใช้ Ellipsoid โดย default
    console.log('✓ Tier 0: Globe (Ellipsoid) initialized');
  }

  // ============================================
  // TIER 1: Terrain (DEM - ความสูง)
  // ============================================
  setupTier1_Terrain() {
    // ใช้ Ellipsoid Terrain (ไม่มีความสูง) สำหรับ Phase 1
    // Phase 2 จะเปลี่ยนเป็น DEM จริง
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
  }

  // ============================================
  // TIER 2: Imagery (Orthophoto, แผนที่)
  // ============================================
  setupTier2_Imagery() {
    // ลบ default imagery
    this.viewer.imageryLayers.removeAll();

    // 1. Base Map: OpenStreetMap
    try {
      this.viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://a.tile.openstreetmap.org/',
        })
      );
      console.log('✓ Tier 2: OSM Base Map loaded');
    } catch (error) {
      console.error('✗ Error loading OSM:', error);
    }

    // 2. Optional: Google Maps Satellite ภาพถ่ายดาวเทียม นำมาแสดงพื้นหลัง
    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        credit: 'Google Maps Satellite',
      });
      this.layers.googleSatellite =
        this.viewer.imageryLayers.addImageryProvider(provider);
      // ซ่อนไว้ตามค่า checkbox (false)
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
      console.log('✓ Tier 2: Google Maps Satellite loaded');
    } catch (error) {
      console.error('✗ Error loading Google Maps:', error);
    }
  }

  // ============================================
  // TIER 3: Vector/Features (ถนน, ขอบเขต, POI)
  // ============================================
  setupTier3_VectorFeatures() {
    // สำหรับ Phase 1 ใช้ WMS (Imagery) ก่อน
    // Phase 2 จะเปลี่ยนเป็น WFS (Vector) เพื่อให้คลิกและ query ได้

    const wmsUrl = `${this.geoserverUrl}/wms`;

    // 1. ขอบเขตจังหวัด (Province Boundaries)
    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:regionth-province-v3`,
      'Province Boundaries'
    );

    // 2. ขอบเขตอำเภอ/ตำบล (District/Subdistrict Boundaries)
    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
      'District/Subdistrict Boundaries'
    );

    // 3. ถนน (Roads)
    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads_free_1`,
      'Roads'
    );

    // 4. คลอง/ทางน้ำ (Waterways)
    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways_free_1`,
      'Waterways'
    );
  }

  // Helper method สำหรับเพิ่ม WMS Layer
  private addWMSLayer(
    url: string,
    layers: string,
    name: string
  ): Cesium.ImageryLayer | null {
    try {
      const provider = new Cesium.WebMapServiceImageryProvider({
        url,
        layers,
        parameters: {
          transparent: true,
          format: 'image/png',
          styles: '',
        },
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      // ซ่อนไว้ทุก layer ให้เลือกจาก checkbox เท่านั้น
      layer.show = false;
      console.log(`✓ Tier 3: ${name} loaded (WMS)`);
      return layer;
    } catch (error) {
      console.error(`✗ Error loading ${name}:`, error);
      return null;
    }
  }

  // ============================================
  // Layer Toggle Methods (เรียกจาก checkbox)
  // ============================================
  toggleGoogleSatellite() {
    if (this.layers.googleSatellite) {
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
    }
  }

  toggleProvinceBoundaries() {
    if (this.layers.provinceBoundaries) {
      this.layers.provinceBoundaries.show =
        this.layerControls.provinceBoundaries;
    }
  }

  toggleDistrictBoundaries() {
    if (this.layers.districtBoundaries) {
      this.layers.districtBoundaries.show =
        this.layerControls.districtBoundaries;
    }
  }

  toggleRoads() {
    if (this.layers.roads) {
      this.layers.roads.show = this.layerControls.roads;
    }
  }

  toggleWaterways() {
    if (this.layers.waterways) {
      this.layers.waterways.show = this.layerControls.waterways;
    }
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
  }
}
