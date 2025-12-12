import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Cesium from 'cesium';

interface CartItem {
  id: string;
  name: string;
  type: string;
  bounds: any;
  addedAt: Date;
}

@Component({
  selector: 'app-map-phase-v3',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-phase-v3.component.html',
  styleUrl: './map-phase-v3.component.scss',
})
export class MapPhaseV3Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'thailand-demo';

  // Layer references for toggling
  private layers = {
    openStreetMap: null as Cesium.ImageryLayer | null,
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
    dem: null as Cesium.ImageryLayer | null,
    contour: null as Cesium.ImageryLayer | null,
  };

  // Layer visibility states (bound to checkboxes)
  layerControls = {
    openStreetMap: false,
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    roads: false,
    waterways: false,
    dem: false,
    contour: false,
  };

  // Phase 3: Shopping Cart
  cart: CartItem[] = [];
  showCart = false;
  selectedFeatures: any[] = [];

  // Phase 3: Selection mode
  selectionMode = false;

  // Phase 3: Watermark settings
  watermarkSettings = {
    enabled: true,
    text: 'DEMO - Not for commercial use',
    opacity: 0.5,
  };

  // Panel collapse states
  panelStates = {
    layerControl: true, // expanded by default
    tools: true, // expanded by default
    cart: false, // collapsed by default
    selection: true, // expanded by default
  };

  // Search feature properties
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  private searchTimeout: any;

  // Toggle panel methods
  toggleLayerPanel() {
    this.panelStates.layerControl = !this.panelStates.layerControl;
  }

  toggleToolsPanel() {
    this.panelStates.tools = !this.panelStates.tools;
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

    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();
    this.setupMapClickHandler();

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  setupTier0_Globe() {
    console.log('✓ Tier 0: Globe (Ellipsoid) initialized');
  }

  setupTier1_Terrain() {
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
  }

  setupTier2_Imagery() {
    // ใช้ Cesium default base map (Bing Maps)
    console.log('✓ Tier 2: Using Cesium default base map (Bing Maps)');

    // Optional: OpenStreetMap (เป็น overlay)
    try {
      const provider = new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/',
      });
      this.layers.openStreetMap =
        this.viewer.imageryLayers.addImageryProvider(provider);
      this.layers.openStreetMap.show = this.layerControls.openStreetMap;
      console.log('✓ Tier 2: OpenStreetMap loaded (optional)');
    } catch (error) {
      console.error('✗ Error loading OSM:', error);
    }

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

    // Phase 2/3: เพิ่ม DEM และ Contour layers
    this.addDEMAndContourLayers();
  }

  // ============================================
  // PHASE 2/3: DEM และ Contour Layers
  // ============================================
  addDEMAndContourLayers() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    // DEM Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.dem = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:dem_layer`,
    //   'DEM Layer'
    // );

    // Contour Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.contour = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:contour_layer`,
    //   'Contour Layer'
    // );

    console.log(
      '✓ DEM and Contour layers configured (TODO: add actual layers)'
    );
  }

  setupTier3_VectorFeatures() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:th_province`,
      'Province Boundaries'
    );

    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
      'District/Subdistrict Boundaries'
    );

    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads`,
      'Roads'
    );

    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways`,
      'Waterways'
    );
  }

  setupMapClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    handler.setInputAction((movement: any) => {
      const pickedPosition = this.viewer.camera.pickEllipsoid(
        movement.position,
        this.viewer.scene.globe.ellipsoid
      );

      if (pickedPosition) {
        const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        if (this.selectionMode) {
          // Phase 3: Selection mode - เลือกพื้นที่
          this.selectAreaAtLocation(longitude, latitude);
        } else {
          // Info mode - แสดงข้อมูล
          console.log(
            `Clicked: Lat ${latitude.toFixed(6)}, Lon ${longitude.toFixed(6)}`
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ============================================
  // Phase 3: Selection & Cart Functions
  // ============================================
  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    console.log('Selection mode:', this.selectionMode ? 'ON' : 'OFF');
  }

  selectAreaAtLocation(longitude: number, latitude: number) {
    // TODO: Query GeoServer WFS สำหรับ ระวาง/พื้นที่ ที่ตำแหน่งนี้
    console.log('Selecting area at:', longitude, latitude);

    // Simulate feature selection
    const feature = {
      id: `feature_${Date.now()}`,
      name: `ระวาง (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      type: 'Land Parcel',
      bounds: { lat: latitude, lon: longitude },
    };

    this.selectedFeatures.push(feature);
    console.log('Selected features:', this.selectedFeatures);

    // TODO: แสดง highlight บนแผนที่
  }

  addToCart(feature: any) {
    const cartItem: CartItem = {
      ...feature,
      addedAt: new Date(),
    };

    this.cart.push(cartItem);
    console.log('Added to cart:', cartItem);
    console.log('Cart items:', this.cart);
  }

  addSelectedToCart() {
    this.selectedFeatures.forEach((feature) => {
      this.addToCart(feature);
    });
    this.selectedFeatures = [];
    this.selectionMode = false;
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
  }

  clearCart() {
    this.cart = [];
  }

  toggleCart() {
    this.showCart = !this.showCart;
  }

  // ============================================
  // Phase 3: Watermark Functions
  // ============================================
  async exportWithWatermark() {
    console.log('Exporting with watermark...');
    console.log('Watermark settings:', this.watermarkSettings);

    // TODO: จับภาพจาก Cesium viewer
    // TODO: เพิ่มลายน้ำลงในภาพ
    // TODO: Download file

    alert('Export with watermark feature - Coming soon!');
  }

  toggleWatermark() {
    this.watermarkSettings.enabled = !this.watermarkSettings.enabled;
    console.log('Watermark:', this.watermarkSettings.enabled ? 'ON' : 'OFF');
  }

  // ============================================
  // Helper Methods
  // ============================================
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

  // Layer toggle methods
  toggleOpenStreetMap() {
    if (this.layers.openStreetMap) {
      this.layers.openStreetMap.show = this.layerControls.openStreetMap;
    }
  }

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

  toggleDEMLayer() {
    if (this.layers.dem) {
      this.layers.dem.show = this.layerControls.dem;
    }
  }

  toggleContourLayer() {
    if (this.layers.contour) {
      this.layers.contour.show = this.layerControls.contour;
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
        'PROV_NAMT',
        'PROV_NAME'
      );
      results.push(...provinceResults);

      // Search districts - Note: current schema doesn't have name fields
      const districtResults = await this.searchLayer(
        `test-thailand:tha_admbndl_admALL_rtsd_itos_20220121`,
        query,
        'district',
        'ADM2_TH',
        'ADM2_EN'
      );
      results.push(...districtResults);

      // Search POI (Points of Interest)
      const poiResults = await this.searchLayer(
        `${this.workspace}:gis_osm_pois`,
        query,
        'poi',
        'name',
        'name'
      );
      results.push(...poiResults);
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
        srsName: 'EPSG:4326', // Request coordinates in WGS84 (lat/lon)
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
