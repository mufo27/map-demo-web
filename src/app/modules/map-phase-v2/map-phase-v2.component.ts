import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-map-phase-v2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-phase-v2.component.html',
  styleUrl: './map-phase-v2.component.scss',
})
export class MapPhaseV2Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'thailand-demo';

  // Layer references for toggling
  private layers = {
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
    // Phase 2: เพิ่ม DEM และ Contour
    demLayer: null as Cesium.ImageryLayer | null,
    contourLayer: null as Cesium.ImageryLayer | null,
  };

  // Layer visibility states (bound to checkboxes)
  layerControls = {
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    roads: false,
    waterways: false,
    // Phase 2
    demLayer: false,
    contourLayer: false,
  };

  // Panel collapse state
  panelCollapsed = false;

  // Search feature properties
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  private searchTimeout: any;

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

    // Phase 2: เพิ่ม click event handler
    this.setupMapClickHandler();

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
    // Phase 2: ใช้ DEM terrain จริง (ถ้ามี)
    // สำหรับตอนนี้ยังใช้ Ellipsoid ไปก่อน
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
    // TODO: เปลี่ยนเป็น DEM terrain จาก GeoServer
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
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
      console.log('✓ Tier 2: Google Maps Satellite loaded');
    } catch (error) {
      console.error('✗ Error loading Google Maps:', error);
    }

    // Phase 2: เพิ่ม DEM และ Contour layers
    this.addDEMAndContourLayers();
  }

  // ============================================
  // TIER 3: Vector/Features (ถนน, ขอบเขต, POI)
  // ============================================
  setupTier3_VectorFeatures() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    // 1. ขอบเขตจังหวัด (Province Boundaries)
    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:th_province`,
      'Province Boundaries'
    );

    // 2. ขอบเขตอำเภอ/ตำบล (District/Subdistrict Boundaries)
    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `test-thailand:tha_admbndl_admALL_rtsd_itos_20220121`,
      'District/Subdistrict Boundaries'
    );

    // 3. ถนน (Roads)
    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads`,
      'Roads'
    );

    // 4. คลอง/ทางน้ำ (Waterways)
    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways`,
      'Waterways'
    );
  }

  // ============================================
  // PHASE 2: DEM และ Contour Layers
  // ============================================
  addDEMAndContourLayers() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    // DEM Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.demLayer = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:dem_layer`,
    //   'DEM Layer'
    // );

    // Contour Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.contourLayer = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:contour_layer`,
    //   'Contour Layer'
    // );

    console.log(
      '✓ DEM and Contour layers configured (TODO: add actual layers)'
    );
  }

  // ============================================
  // PHASE 2: Map Click Handler
  // ============================================
  setupMapClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    handler.setInputAction((movement: any) => {
      // Get clicked position
      const pickedPosition = this.viewer.camera.pickEllipsoid(
        movement.position,
        this.viewer.scene.globe.ellipsoid
      );

      if (pickedPosition) {
        const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        console.log(
          `Clicked position: Lat ${latitude.toFixed(
            6
          )}, Lon ${longitude.toFixed(6)}`
        );

        // TODO: Query GeoServer WFS สำหรับข้อมูล feature ที่ตำแหน่งนี้
        // TODO: แสดง popup/info window
        this.queryFeaturesAtLocation(longitude, latitude);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // Query features from GeoServer WFS
  async queryFeaturesAtLocation(longitude: number, latitude: number) {
    console.log('TODO: Query GeoServer WFS at:', longitude, latitude);
    // TODO: ใช้ WFS GetFeature request เพื่อ query ข้อมูล
    // TODO: แสดงผลใน popup หรือ info panel
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

  // Phase 2: Toggle methods
  toggleDEMLayer() {
    if (this.layers.demLayer) {
      this.layers.demLayer.show = this.layerControls.demLayer;
    }
  }

  toggleContourLayer() {
    if (this.layers.contourLayer) {
      this.layers.contourLayer.show = this.layerControls.contourLayer;
    }
  }

  // ============================================
  // Search Feature Methods
  // ============================================
  onSearchInput() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch();
    }, 300);
  }

  async performSearch() {
    if (!this.searchQuery.trim()) return;

    this.searchResults = [];
    this.showSearchResults = true;

    try {
      const results = await this.searchGeoServer(this.searchQuery);
      this.searchResults = results;
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults = [];
    }
  }

  async searchGeoServer(query: string): Promise<any[]> {
    const results: any[] = [];

    try {
      const provinceResults = await this.searchLayer(
        `${this.workspace}:th_province`,
        query,
        'province',
        'prov_namt',
        'prov_nameen'
      );
      results.push(...provinceResults);

      const districtResults = await this.searchLayer(
        `${this.workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
        query,
        'district',
        'adm2_th',
        'adm2_en'
      );
      results.push(...districtResults);
    } catch (error) {
      console.error('GeoServer search error:', error);
    }

    return results.slice(0, 10);
  }

  async searchLayer(
    layerName: string,
    query: string,
    type: string,
    thField: string,
    enField: string
  ): Promise<any[]> {
    try {
      const wfsUrl = `${this.geoserverUrl}/wfs`;
      const filter = `${thField} LIKE '%${query}%' OR ${enField} LIKE '%${query}%'`;

      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        CQL_FILTER: filter,
        maxFeatures: '5',
      });

      const response = await fetch(`${wfsUrl}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`WFS request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return [];
      }

      return data.features.map((feature: any) => {
        const props = feature.properties;
        const geometry = feature.geometry;

        let longitude = 0;
        let latitude = 0;
        let height = 50000;

        if (geometry.type === 'Point') {
          [longitude, latitude] = geometry.coordinates;
        } else if (geometry.type === 'Polygon') {
          const coords = geometry.coordinates[0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        } else if (geometry.type === 'MultiPolygon') {
          const coords = geometry.coordinates[0][0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        }

        const nameTh = props[thField] || '';
        const nameEn = props[enField] || '';
        const displayName = nameTh || nameEn;

        return {
          name: displayName,
          nameTh,
          nameEn,
          type,
          typeLabel: this.getTypeLabel(type),
          longitude,
          latitude,
          height,
          icon: this.getTypeIcon(type),
        };
      });
    } catch (error) {
      console.error(`Error searching ${layerName}:`, error);
      return [];
    }
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      province: 'จังหวัด',
      district: 'อำเภอ/ตำบล',
      poi: 'สถานที่',
    };
    return labels[type] || type;
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      province: '🗺️',
      district: '📍',
      poi: '🏢',
    };
    return icons[type] || '📌';
  }

  selectSearchResult(result: any) {
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height
      ),
      duration: 2,
    });

    this.showSearchResults = false;
    console.log('Flying to:', result.name, result);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.viewer?.destroy();
  }
}
